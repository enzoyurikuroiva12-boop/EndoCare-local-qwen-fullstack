$ErrorActionPreference = 'Stop'
$taskFrontendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$taskFrontendDirectory = Join-Path $taskFrontendRoot 'frontend'
$taskStateDirectory = Join-Path $taskFrontendRoot '.local-run'
$taskProjectsDirectory = Split-Path -Parent $taskFrontendRoot

function Test-CommandPath {
    param([string]$CommandLine, [string]$Path)
    if (-not $CommandLine) { return $false }
    $command = $CommandLine.Replace('/', '\') -replace '\\+', '\'
    $expected = $Path.Replace('/', '\') -replace '\\+', '\'
    return $command -match ('(?i)(?:^|[\s"])' + [regex]::Escape($expected) + '(?:"|\s|$)')
}

function Get-ServiceListener {
    param([int]$Port, [string]$ServerPath, [string]$Name)
    $ownerIds = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    $listener = $null
    foreach ($ownerId in $ownerIds) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
        if (-not $process -or $process.Name -ne 'node.exe' -or
            -not (Test-CommandPath $process.CommandLine $ServerPath)) {
            throw "A porta $Port esta ocupada por outro programa. Nao foi possivel iniciar $Name."
        }
        $listener = $process
    }
    return $listener
}

function Test-ServiceHealth {
    param([string]$Name)
    try {
        if ($Name -eq 'backend') {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 8
            return $health.service -eq 'endobot' -and $health.status -eq 'ok'
        }
        $page = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 5
        return $page.StatusCode -eq 200 -and $page.Content -match '/@vite/client' -and
            $page.Content -match '/src/main\.tsx'
    } catch { return $false }
}

function Save-ServiceState {
    param([string]$Name, $Process, [string]$WrapperPath, [string]$WorkingDirectory, $Listener)
    @{
        pid = [int]$Process.ProcessId
        creationDateUtc = $Process.CreationDate.ToUniversalTime().ToString('o')
        executablePath = $Process.ExecutablePath
        wrapperPath = $WrapperPath
        workingDirectory = $WorkingDirectory
        serverPid = if ($Listener) { [int]$Listener.ProcessId } else { $null }
        serverCreationDateUtc = if ($Listener) { $Listener.CreationDate.ToUniversalTime().ToString('o') } else { $null }
        stdoutLog = Join-Path $taskStateDirectory "$Name.stdout.log"
        stderrLog = Join-Path $taskStateDirectory "$Name.stderr.log"
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskStateDirectory "$Name-process.json") -Encoding utf8
}

function Start-ServiceNode {
    param([string]$Name, [string]$WrapperPath, [string]$WorkingDirectory)
    Write-Host "Iniciando $Name em segundo plano..."
    $startOptions = @{
        FilePath = $taskNode
        ArgumentList = '"' + $WrapperPath + '"'
        WorkingDirectory = $WorkingDirectory
        WindowStyle = 'Hidden'
        PassThru = $true
        RedirectStandardOutput = Join-Path $taskStateDirectory "$Name.stdout.log"
        RedirectStandardError = Join-Path $taskStateDirectory "$Name.stderr.log"
    }
    $started = Start-Process @startOptions
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($started.Id)" -ErrorAction SilentlyContinue
    if (-not $process) { throw "$Name encerrou durante a inicializacao. Confira os logs em $taskStateDirectory." }
    Save-ServiceState $Name $process $WrapperPath $WorkingDirectory $null
    return $process
}

function Wait-ServiceReady {
    param([string]$Name, [int]$Port, [string]$ServerPath, $StartedProcess)
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        $listener = Get-ServiceListener $Port $ServerPath $Name
        if ($listener -and (Test-ServiceHealth $Name)) { return $listener }
        if ($StartedProcess) {
            $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($StartedProcess.ProcessId)" -ErrorAction SilentlyContinue
            if (-not $live -or $live.CreationDate -ne $StartedProcess.CreationDate) {
                throw "$Name encerrou antes de ficar pronto. Confira os logs em $taskStateDirectory."
            }
        }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Name nao passou na verificacao de saude da porta $Port. Confira os logs em $taskStateDirectory."
}

function Save-ReadyService {
    param([string]$Name, $Listener, [string]$WrapperPath, [string]$WorkingDirectory)
    $process = $Listener
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($Listener.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parent -and $parent.Name -eq 'node.exe' -and (Test-CommandPath $parent.CommandLine $WrapperPath)) {
        $process = $parent
    }
    Save-ServiceState $Name $process $WrapperPath $WorkingDirectory $Listener
}

try {
    $taskNode = (Get-Command node.exe -ErrorAction Stop).Source
    $taskPowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath (Join-Path $taskFrontendDirectory '.env'))) {
        throw 'Execute BAIXAR_ENDOCARE.bat e configure frontend\.env primeiro.'
    }
    $taskBackendDirectory = Join-Path $taskFrontendRoot 'backend'
    if (-not (Test-Path -LiteralPath (Join-Path $taskBackendDirectory 'scripts\start-local.mjs'))) {
        $taskBackendRoot = @('backend2-local-qwen-backup', 'backend2-local-qwen-backup-main') |
            ForEach-Object { Join-Path $taskProjectsDirectory $_ } |
            Where-Object { Test-Path -LiteralPath (Join-Path $_ 'backend\scripts\start-local.mjs') } |
            Select-Object -First 1
        if (-not $taskBackendRoot) {
            throw 'Nao encontrei backend\scripts\start-local.mjs neste repositorio nem em uma pasta de backend irma.'
        }
        $taskBackendDirectory = Join-Path $taskBackendRoot 'backend'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $taskBackendDirectory '.env'))) {
        throw 'Configure backend\.env antes de iniciar o EndoCare.'
    }
    $taskBackendWrapper = Join-Path $taskBackendDirectory 'scripts\start-local.mjs'
    $taskBackendServer = Join-Path $taskBackendDirectory 'scripts\local-server.ts'
    $taskFrontendWrapper = Join-Path $taskFrontendRoot 'scripts\start-frontend.mjs'
    $taskFrontendServer = Join-Path $taskFrontendDirectory 'node_modules\vite\bin\vite.js'
    Push-Location $taskBackendDirectory
    try {
        & $taskNode --import tsx --eval 'process.exit(0)' 2>$null
        $taskTsxAvailable = $LASTEXITCODE -eq 0
    } finally {
        Pop-Location
    }
    if (-not (Test-Path -LiteralPath $taskFrontendServer) -or -not $taskTsxAvailable) {
        throw 'Instale as dependencias com BAIXAR_ENDOCARE.bat primeiro.'
    }
    New-Item -ItemType Directory -Path $taskStateDirectory -Force | Out-Null
    # Confirma o comando de todos os donos das portas antes de reutilizar uma instancia.
    $taskBackendListener = Get-ServiceListener 3000 $taskBackendServer 'backend'
    $taskFrontendListener = Get-ServiceListener 5173 $taskFrontendServer 'frontend'
    & $taskPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskBackendDirectory 'scripts\start-ollama.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'O Ollama local nao respondeu. Confira a mensagem acima.' }

    $taskStartedBackend = $null
    $taskStartedFrontend = $null
    if ($taskBackendListener) { Write-Host 'Backend EndoCare existente sera reutilizado.' }
    else { $taskStartedBackend = Start-ServiceNode 'backend' $taskBackendWrapper $taskBackendDirectory }
    if ($taskFrontendListener) { Write-Host 'Frontend EndoCare existente sera reutilizado.' }
    else { $taskStartedFrontend = Start-ServiceNode 'frontend' $taskFrontendWrapper $taskFrontendDirectory }

    $taskBackendListener = Wait-ServiceReady 'backend' 3000 $taskBackendServer $taskStartedBackend
    $taskFrontendListener = Wait-ServiceReady 'frontend' 5173 $taskFrontendServer $taskStartedFrontend
    Save-ReadyService 'backend' $taskBackendListener $taskBackendWrapper $taskBackendDirectory
    Save-ReadyService 'frontend' $taskFrontendListener $taskFrontendWrapper $taskFrontendDirectory
    Write-Host 'Frontend e backend verificados. Chat de texto pronto.'
    Write-Host "Logs de inicializacao: $taskStateDirectory"

    $taskVoiceRoot = Join-Path $taskBackendDirectory 'local-voice'
    if (Test-Path -LiteralPath (Join-Path $taskVoiceRoot '.venv\Scripts\python.exe')) {
        try {
            & $taskPowerShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskVoiceRoot 'Start-OmniVoice.ps1')
            if ($LASTEXITCODE -ne 0) { throw 'Confira backend\local-voice\stderr.log.' }
        } catch { Write-Warning ("Voz local indisponivel: " + $_.Exception.Message + ' O chat de texto continua pronto.') }
    } else {
        Write-Host 'Voz opcional: execute BAIXAR_ENDOCARE.bat e aceite a opcao de voz para instalar.'
    }
    exit 0
} catch {
    Write-Host ('Falha ao iniciar EndoCare: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host "Logs: $taskStateDirectory\backend.stderr.log e $taskStateDirectory\frontend.stderr.log"
    exit 1
}

