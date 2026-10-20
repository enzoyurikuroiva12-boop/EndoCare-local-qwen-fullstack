$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$taskFrontendDirectory = Join-Path $taskRoot 'frontend'
$taskBackendDirectory = Join-Path $taskRoot 'backend'
$taskStartedOllamaForInstall = $false
$taskPreviousOllamaHost = [Environment]::GetEnvironmentVariable('OLLAMA_HOST', 'Process')

function Invoke-CheckedCommand {
    param([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory, [string]$Description)
    Push-Location $WorkingDirectory
    try {
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$Description falhou (codigo $LASTEXITCODE)." }
    } finally { Pop-Location }
}

function Test-LocalOllama {
    try {
        $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
        return $tags.PSObject.Properties.Name -contains 'models'
    } catch { return $false }
}

function Stop-InstallerOllama {
    $statePath = Join-Path $taskBackendDirectory '.local-run\ollama-process.json'
    if (-not (Test-Path -LiteralPath $statePath)) { return }
    try {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
        $created = [DateTimeOffset]::Parse([string]$state.creationDateUtc, [Globalization.CultureInfo]::InvariantCulture).UtcDateTime
        $matches = $process -and $process.Name -eq 'ollama.exe' -and
            $process.ExecutablePath -eq $state.executablePath -and
            $process.CreationDate.ToUniversalTime() -eq $created -and
            $process.CommandLine -match '(?i)\bserve\s*$' -and $state.host -eq '127.0.0.1:11434'
        if ($matches) {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
            $live = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
            if (-not $live -or $live.CreationDate.ToUniversalTime() -ne $created) {
                Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
                Write-Host 'Servidor Ollama iniciado apenas para o download foi encerrado.'
            } else { Write-Warning 'O Ollama ainda esta ativo; execute ENCERRAR_ENDOCARE.bat para encerra-lo.' }
        }
    } catch { Write-Warning ('Nao foi possivel confirmar o encerramento do Ollama: ' + $_.Exception.Message) }
}

try {
    Write-Host 'EndoCare - baixar e instalar dependencias' -ForegroundColor Cyan
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) { throw 'Node.js nao encontrado. Instale Node.js 20 ou superior em https://nodejs.org/.' }
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { throw 'npm.cmd nao encontrado. Reinstale Node.js incluindo o npm e reinicie o terminal.' }
    $ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if (-not $ollama) { throw 'Ollama nao encontrado. Instale em https://ollama.com/download/windows.' }

    $globalRoot = (& $npm.Source root --global | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $globalRoot) { throw 'Nao foi possivel localizar a pasta global do npm.' }
    $pnpmEntry = Join-Path $globalRoot 'pnpm\bin\pnpm.cjs'
    $pnpmVersion = if (Test-Path -LiteralPath $pnpmEntry) { (& $node.Source $pnpmEntry --version | Select-Object -Last 1).Trim() } else { '' }
    if ($pnpmVersion -ne '10.4.1') {
        Write-Host 'Instalando pnpm 10.4.1, versao fixada pelo projeto...'
        & $npm.Source install --global pnpm@10.4.1
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel instalar pnpm pelo npm.' }
        $globalRoot = (& $npm.Source root --global | Select-Object -Last 1).Trim()
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel localizar a pasta global do npm.' }
        $pnpmEntry = Join-Path $globalRoot 'pnpm\bin\pnpm.cjs'
    }
    if (-not (Test-Path -LiteralPath $pnpmEntry)) { throw "Arquivo do pnpm nao encontrado: $pnpmEntry" }
    $pnpmVersion = (& $node.Source $pnpmEntry --version | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or $pnpmVersion -ne '10.4.1') { throw "Esperava pnpm 10.4.1, encontrei '$pnpmVersion'." }
    Write-Host "Usando Node $((& $node.Source --version | Select-Object -Last 1).Trim()) e pnpm $pnpmVersion."

    foreach ($item in @(
        @{ Directory = $taskFrontendDirectory; Env = 'frontend\.env'; Example = 'frontend\.env.example' },
        @{ Directory = $taskBackendDirectory; Env = 'backend\.env'; Example = 'backend\.env.example' }
    )) {
        if (-not (Test-Path -LiteralPath $item.Directory)) { throw "Pasta nao encontrada: $($item.Directory)" }
        $envPath = Join-Path $taskRoot $item.Env
        if (-not (Test-Path -LiteralPath $envPath)) {
            $examplePath = Join-Path $taskRoot $item.Example
            if (-not (Test-Path -LiteralPath $examplePath)) { throw "Modelo ausente: $($item.Example)" }
            Copy-Item -LiteralPath $examplePath -Destination $envPath
            Write-Host "Criado $($item.Env) a partir do modelo; configure as chaves antes de iniciar."
        } else { Write-Host "$($item.Env) existente preservado." }
    }

    Invoke-CheckedCommand $node.Source @($pnpmEntry, 'install', '--frozen-lockfile') $taskFrontendDirectory 'Instalacao do frontend'
    Invoke-CheckedCommand $node.Source @($pnpmEntry, 'install', '--frozen-lockfile') $taskBackendDirectory 'Instalacao do backend'
    Push-Location $taskBackendDirectory
    try { & $node.Source --import tsx --eval 'process.exit(0)' 2>$null; $tsxReady = $LASTEXITCODE -eq 0 }
    finally { Pop-Location }
    if (-not $tsxReady) {
        Write-Host 'Reparando a instalacao incompleta do backend...'
        Invoke-CheckedCommand $node.Source @($pnpmEntry, 'install', '--force', '--frozen-lockfile') $taskBackendDirectory 'Reparo do backend'
        Push-Location $taskBackendDirectory
        try { & $node.Source --import tsx --eval 'process.exit(0)' 2>$null; $tsxReady = $LASTEXITCODE -eq 0 }
        finally { Pop-Location }
        if (-not $tsxReady) { throw 'O pacote tsx nao pode ser carregado. Confira Node.js e pnpm.' }
    }

    $env:OLLAMA_HOST = '127.0.0.1:11434'
    if (-not (Test-LocalOllama)) {
        Write-Host 'Iniciando Ollama para baixar o modelo Qwen...'
        $powershell = Get-Command powershell.exe -ErrorAction Stop
        $taskStartedOllamaForInstall = $true
        & $powershell.Source -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskBackendDirectory 'scripts\start-ollama.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'O Ollama nao iniciou. Confira a mensagem acima.' }
    } else { Write-Host 'Ollama ja estava ativo e sera mantido em execucao.' }
    Write-Host 'Baixando qwen2.5:3b. Isso pode levar alguns minutos...'
    & $ollama.Source pull qwen2.5:3b
    if ($LASTEXITCODE -ne 0) { throw 'O download de qwen2.5:3b falhou.' }
    if ($taskStartedOllamaForInstall) { Stop-InstallerOllama }

    $voiceAnswer = Read-Host 'Deseja instalar tambem OmniVoice? Requer Python 3.12, uv e cerca de 7 GB. [s/N]'
    if ($voiceAnswer -match '^(?i)s(sim)?$') {
        $powershell = Get-Command powershell.exe -ErrorAction Stop
        & $powershell.Source -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskBackendDirectory 'local-voice\Install-OmniVoice.ps1')
        if ($LASTEXITCODE -ne 0) { throw 'A instalacao OmniVoice falhou.' }
    } else { Write-Host 'OmniVoice ignorado; o chat de texto continua disponivel.' }

    Write-Host ''
    Write-Host 'Instalacao concluida. Revise frontend\.env e backend\.env antes de iniciar.' -ForegroundColor Green
    Write-Host 'Para iniciar, execute INICIAR_ENDOCARE.bat.'
} catch {
    Write-Host ('Falha na instalacao: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($null -eq $taskPreviousOllamaHost) { Remove-Item Env:OLLAMA_HOST -ErrorAction SilentlyContinue }
    else { $env:OLLAMA_HOST = $taskPreviousOllamaHost }
    if ($taskStartedOllamaForInstall) { Stop-InstallerOllama }
}
