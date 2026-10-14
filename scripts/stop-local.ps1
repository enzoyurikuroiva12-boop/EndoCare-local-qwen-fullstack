[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param()

$ErrorActionPreference = 'Stop'
# Carrega os modulos antes da simulacao para nao listar seus aliases internos
# como se fossem operacoes de encerramento.
$simulate = $WhatIfPreference
$WhatIfPreference = $false
Import-Module CimCmdlets, NetTCPIP
$WhatIfPreference = $simulate
$frontendRepository = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$projectsDirectory = Split-Path -Parent $frontendRepository
$backendRepositories = @(
    $frontendRepository,
    (Join-Path $projectsDirectory 'backend2-local-qwen-backup'),
    (Join-Path $projectsDirectory 'backend2-local-qwen-backup-main')
)
$processes = @(Get-CimInstance Win32_Process)
$allListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
$processById = @{}
$targets = @{}
foreach ($process in $processes) { $processById[[int]$process.ProcessId] = $process }

function Test-CommandPath {
    param([string]$CommandLine, [string]$Path)
    if (-not $CommandLine) { return $false }
    $command = $CommandLine.Replace('/', '\') -replace '\\+', '\'
    $expected = $Path.Replace('/', '\') -replace '\\+', '\'
    return $command.IndexOf($expected, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Add-ProcessTree {
    param([int]$ProcessId, [string]$Service)
    if ($ProcessId -eq $PID -or $targets.ContainsKey($ProcessId) -or -not $processById.ContainsKey($ProcessId)) { return }
    $process = $processById[$ProcessId]
    $targets[$ProcessId] = [pscustomobject]@{ Process = $process; Service = $Service }
    foreach ($child in $processes) {
        if ([int]$child.ParentProcessId -eq $ProcessId) {
            Add-ProcessTree -ProcessId ([int]$child.ProcessId) -Service $Service
        }
    }
}

function Add-ServiceWrappers {
    param($Process, [string]$Service)
    $parent = $processById[[int]$Process.ParentProcessId]
    while ($parent -and $parent.ProcessId -ne $PID) {
        $command = [string]$parent.CommandLine
        $isWrapper = ($parent.Name -eq 'cmd.exe' -and $command -match '(?i)/c\s+.*(vite|pnpm\.cmd\s+dev|vercel\.cmd\s+dev)') -or
            ($parent.Name -eq 'node.exe' -and $command -match '(?i)pnpm[\\/].*(?:\sdev:local\b|\sdev\b.*(?:5173|strictPort))') -or
            ($parent.Name -eq 'node.exe' -and $Service -eq 'Backend EndoCare' -and $command -match '(?i)scripts[\\/]start-local\.mjs') -or
            ($parent.Name -eq 'node.exe' -and $Service -eq 'Frontend EndoCare' -and $command -match '(?i)scripts[\\/]start-frontend\.mjs')
        if (-not $isWrapper) { break }
        Add-ProcessTree -ProcessId ([int]$parent.ProcessId) -Service $Service
        $parent = $processById[[int]$parent.ParentProcessId]
    }
}

function Get-TargetDepth {
    param($Target)
    $depth = 0
    $parentId = [int]$Target.Process.ParentProcessId
    $visited = @{}
    while ($targets.ContainsKey($parentId) -and -not $visited.ContainsKey($parentId)) {
        $visited[$parentId] = $true
        $depth++
        $parentId = [int]$targets[$parentId].Process.ParentProcessId
    }
    return $depth
}

foreach ($process in $processes) {
    $command = [string]$process.CommandLine
    if ($process.Name -in @('node.exe', 'cmd.exe') -and
        ((Test-CommandPath $command (Join-Path $frontendRepository 'frontend\node_modules\')) -or
         (Test-CommandPath $command (Join-Path $frontendRepository 'scripts\start-frontend.mjs'))) -and
        $command -match '(?i)\bvite(?:\.js)?\b|start-frontend\.mjs') {
        Add-ProcessTree -ProcessId ([int]$process.ProcessId) -Service 'Frontend EndoCare'
        Add-ServiceWrappers -Process $process -Service 'Frontend EndoCare'
    }
    foreach ($repository in $backendRepositories) {
        if ($process.Name -eq 'cmd.exe' -and $command -match '(?i)/c\s' -and
            (Test-CommandPath $command (Join-Path $repository 'INICIAR_BACKEND_QWEN.bat'))) {
            Add-ProcessTree -ProcessId ([int]$process.ProcessId) -Service 'Backend EndoCare'
        }
        if ($process.Name -in @('node.exe', 'cmd.exe') -and
            (Test-CommandPath $command (Join-Path $repository 'backend')) -and
            $command -match '(?i)start-local\.mjs|local-server\.ts|vercel.*\bdev\b|INICIAR_BACKEND_QWEN\.bat') {
            Add-ProcessTree -ProcessId ([int]$process.ProcessId) -Service 'Backend EndoCare'
            Add-ServiceWrappers -Process $process -Service 'Backend EndoCare'
        }
        $isVoiceServer = ($process.Name -in @('python.exe', 'pythonw.exe') -or
            ($process.Name -eq 'cmd.exe' -and $command -match '(?i)/c\s')) -and
            $command -notmatch '(?i)--download-only\b|\s-c\s'
        if ($isVoiceServer -and
            (Test-CommandPath $command (Join-Path $repository 'backend\local-voice\server.py'))) {
            Add-ProcessTree -ProcessId ([int]$process.ProcessId) -Service 'OmniVoice EndoCare'
        }
    }
}

function Test-OllamaServe {
    param($Process)
    return $Process -and $Process.Name -eq 'ollama.exe' -and
        $Process.ExecutablePath -match '(?i)[\\/]Ollama[\\/]' -and
        $Process.CommandLine -match '(?i)\bserve\s*$'
}

# A porta pode ser retomada por outra aplicacao depois que o EndoCare encerra.
# Com registro presente, somente o PID/CreationDate/executavel/host registrados
# sao autorizados. Um registro antigo nunca autoriza o novo dono da mesma porta.
$hasOllamaState = $false
foreach ($repository in $backendRepositories) {
    $statePath = Join-Path $repository 'backend\.local-run\ollama-process.json'
    if (-not (Test-Path -LiteralPath $statePath)) { continue }
    $hasOllamaState = $true
    try {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $process = $processById[[int]$state.pid]
        if (-not (Test-OllamaServe $process) -or $state.host -ne '127.0.0.1:11434' -or
            $process.ExecutablePath -ne $state.executablePath -or
            $process.CreationDate.ToUniversalTime() -ne ([DateTimeOffset]::Parse($state.creationDateUtc)).UtcDateTime) { continue }
        $otherPort = $allListeners | Where-Object { $_.OwningProcess -eq $state.pid -and $_.LocalPort -ne 11434 }
        if (-not $otherPort) { Add-ProcessTree -ProcessId ([int]$state.pid) -Service 'Ollama local' }
    } catch { Write-Verbose 'Registro antigo de Ollama ignorado.' }
}

function Test-LegacyEndoCareOllama {
    param($Process)
    $parent = $processById[[int]$Process.ParentProcessId]
    $visited = @{}
    $provenLauncher = $false
    while ($parent -and -not $visited.ContainsKey([int]$parent.ProcessId)) {
        $visited[[int]$parent.ProcessId] = $true
        # Ollama iniciado por uma aplicacao Python nao pertence a este iniciador.
        if ($parent.Name -in @('python.exe', 'pythonw.exe')) { return $false }
        foreach ($repository in $backendRepositories) {
            if (($parent.Name -in @('powershell.exe', 'pwsh.exe') -and
                 (Test-CommandPath $parent.CommandLine (Join-Path $repository 'backend\scripts\start-ollama.ps1'))) -or
                ($parent.Name -eq 'cmd.exe' -and $parent.CommandLine -match '(?i)/c\s' -and
                 (Test-CommandPath $parent.CommandLine (Join-Path $repository 'INICIAR_BACKEND_QWEN.bat')))) {
                $provenLauncher = $true
            }
        }
        $parent = $processById[[int]$parent.ParentProcessId]
    }
    return $provenLauncher
}

# Legado sem registro exige um ancestral comprovado do iniciador EndoCare.
# Apenas porta 11434 e resposta /api/tags nao comprovam a origem do servidor.
if (-not $hasOllamaState) {
    $ollamaOwners = @($allListeners | Where-Object LocalPort -eq 11434 |
        Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($ownerId in $ollamaOwners) {
        $process = $processById[[int]$ownerId]
        if ((Test-OllamaServe $process) -and (Test-LegacyEndoCareOllama $process)) {
            Add-ProcessTree -ProcessId ([int]$ownerId) -Service 'Ollama local'
        } else { Write-Verbose 'Ollama existente sem prova de origem EndoCare foi preservado.' }
    }
}

# Um app de bandeja so e alvo se for o pai comprovado do servidor identificado e
# nao supervisionar outro servidor. Apps Ollama de outras portas ficam ativos.
foreach ($target in @($targets.Values | Where-Object { $_.Service -eq 'Ollama local' -and (Test-OllamaServe $_.Process) })) {
    $parent = $processById[[int]$target.Process.ParentProcessId]
    if (-not $parent -or $parent.Name -ne 'ollama app.exe' -or
        $parent.ExecutablePath -notmatch '(?i)[\\/]Ollama[\\/]') { continue }
    $otherServer = $processes | Where-Object {
        $_.ParentProcessId -eq $parent.ProcessId -and (Test-OllamaServe $_) -and
        -not $targets.ContainsKey([int]$_.ProcessId)
    }
    if (-not $otherServer) { Add-ProcessTree -ProcessId ([int]$parent.ProcessId) -Service 'Ollama local' }
}

# Compatibilidade com instancias antigas: valida a identidade da API e o comando
# do processo dono da porta. Uma porta ocupada, sozinha, nunca autoriza encerramento.
$listeners = @($allListeners |
    Where-Object { $_.LocalPort -in @(3000, 3001) })
foreach ($listener in $listeners) {
    if ($targets.ContainsKey([int]$listener.OwningProcess)) { continue }
    $process = $processById[[int]$listener.OwningProcess]
    if (-not $process -or $process.Name -ne 'node.exe' -or
        $process.CommandLine -notmatch '(?i)[\\/]vercel[\\/].*\bdev\b') { continue }
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($listener.LocalPort)/api/health" -TimeoutSec 4
        if ($health.service -eq 'endobot') {
            Add-ProcessTree -ProcessId ([int]$process.ProcessId) -Service 'Backend EndoCare'
            $parent = $processById[[int]$process.ParentProcessId]
            # O iniciador antigo usava caminho relativo, mas a API confirma o servico.
            if ($parent -and $parent.Name -eq 'cmd.exe') {
                $launcher = $processById[[int]$parent.ParentProcessId]
                if ($launcher -and $launcher.Name -eq 'node.exe' -and
                    $launcher.CommandLine -match '(?i)scripts[\\/]start-local\.mjs') {
                    Add-ProcessTree -ProcessId ([int]$launcher.ProcessId) -Service 'Backend EndoCare'
                    Add-ServiceWrappers -Process $launcher -Service 'Backend EndoCare'
                }
            }
            Add-ServiceWrappers -Process $process -Service 'Backend EndoCare'
        }
    } catch {
        Write-Verbose "A identidade do servico na porta $($listener.LocalPort) nao foi confirmada."
    }
}

if ($targets.Count -eq 0) {
    Write-Host 'Nenhum servico local do EndoCare esta em execucao.'
    exit 0
}

Write-Host 'Servicos identificados para encerramento:'
$targets.Values | Sort-Object Service, @{Expression = { $_.Process.ProcessId }} | ForEach-Object {
    Write-Host ("  {0}: {1} (PID {2})" -f $_.Service, $_.Process.Name, $_.Process.ProcessId)
}

if (($targets.Values | Where-Object Service -eq 'Ollama local') -and
    $PSCmdlet.ShouldProcess('qwen2.5:3b no Ollama local', 'Descarregar modelo da memoria')) {
    try {
        $ollamaCommand = Get-Command ollama.exe -ErrorAction SilentlyContinue
        $unloaded = $false
        if ($ollamaCommand) {
            $unloader = New-Object System.Diagnostics.Process
            $unloader.StartInfo.FileName = $ollamaCommand.Source
            $unloader.StartInfo.Arguments = 'stop qwen2.5:3b'
            $unloader.StartInfo.EnvironmentVariables['OLLAMA_HOST'] = '127.0.0.1:11434'
            $unloader.StartInfo.UseShellExecute = $false
            $unloader.StartInfo.CreateNoWindow = $true
            $unloader.StartInfo.RedirectStandardOutput = $true
            $unloader.StartInfo.RedirectStandardError = $true
            $unloader.Start() | Out-Null
            if ($unloader.WaitForExit(8000)) { $unloaded = $unloader.ExitCode -eq 0 }
            else { $unloader.Kill() }
            $unloader.Dispose()
        }
        if (-not $unloaded) {
            Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -ContentType 'application/json' `
                -Body '{"model":"qwen2.5:3b","keep_alive":0}' -TimeoutSec 8 | Out-Null
        }
        Write-Host 'Modelo qwen2.5:3b descarregado.'
    } catch {
        Write-Host 'O Ollama nao respondeu ao descarregamento; seus processos serao encerrados.'
    }
}

$failures = 0
# Para os pais antes dos filhos: supervisores nao devem recriar workers enquanto
# os seus processos auxiliares estao sendo encerrados.
foreach ($target in ($targets.Values | Sort-Object @{Expression = { if ($_.Process.Name -eq 'ollama app.exe') { 0 } else { 1 } }}, @{Expression = { Get-TargetDepth $_ }}, @{Expression = { $_.Process.ProcessId }})) {
    $process = $target.Process
    $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)" -ErrorAction SilentlyContinue
    if (-not $live -or $live.CreationDate -ne $process.CreationDate) { continue }
    if ($PSCmdlet.ShouldProcess("$($target.Service), $($process.Name), PID $($process.ProcessId)", 'Encerrar processo')) {
        try { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop }
        catch {
            $stillRunning = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)" -ErrorAction SilentlyContinue
            if ($stillRunning -and $stillRunning.CreationDate -eq $process.CreationDate) {
                Write-Warning "Nao foi possivel encerrar $($target.Service), PID $($process.ProcessId): $($_.Exception.Message)"
                $failures++
            }
        }
    }
}

if (-not $WhatIfPreference) {
    Start-Sleep -Milliseconds 750
    foreach ($target in $targets.Values) {
        $process = $target.Process
        $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)" -ErrorAction SilentlyContinue
        if ($live -and $live.CreationDate -eq $process.CreationDate) {
            Write-Warning "$($target.Service) ainda esta ativo (PID $($process.ProcessId))."
            $failures++
        }
    }
    if ($failures -gt 0) { exit 1 }
    Write-Host 'EndoCare encerrado. Frontend, backend, OmniVoice e Ollama identificados foram parados.'
} else {
    Write-Host 'Simulacao concluida: nenhum processo foi encerrado.'
}

