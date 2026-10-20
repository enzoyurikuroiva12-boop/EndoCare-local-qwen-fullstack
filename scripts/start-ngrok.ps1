$ErrorActionPreference = 'Stop'

$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$taskStateDirectory = Join-Path $taskRoot '.local-run'
$taskNgrokStatePath = Join-Path $taskStateDirectory 'ngrok-process.json'
$taskFrontendDirectory = Join-Path $taskRoot 'frontend'
$taskFrontendServer = Join-Path $taskFrontendDirectory 'node_modules\vite\bin\vite.js'
$taskAccessPath = Join-Path $taskStateDirectory 'ngrok-access.txt'
$taskGuardPath = Join-Path $taskRoot 'scripts\ngrok-guard.mjs'
$taskGuardPort = 5174
$taskInspectorPort = 4040
$taskNgrok = Get-Command ngrok.exe -ErrorAction SilentlyContinue
$taskNode = Get-Command node.exe -ErrorAction SilentlyContinue
$taskPowerShell = Get-Command powershell.exe -ErrorAction Stop
$taskGuardProcess = $null
$taskNgrokProcess = $null
$taskPreviousUser = [Environment]::GetEnvironmentVariable('ENDOCARE_NGROK_USER', 'Process')
$taskPreviousPassword = [Environment]::GetEnvironmentVariable('ENDOCARE_NGROK_PASSWORD', 'Process')
$taskPreviousCookie = [Environment]::GetEnvironmentVariable('ENDOCARE_NGROK_COOKIE', 'Process')

try {
    if (-not $taskNgrok) { throw 'Ngrok nao encontrado. Instale o agente e configure o authtoken da sua conta.' }
    if (-not $taskNode) { throw 'Node.js nao encontrado.' }
    if (-not (Test-Path -LiteralPath $taskFrontendServer)) { throw 'Instale as dependencias do frontend antes de iniciar o tunel.' }
    if (-not (Test-Path -LiteralPath $taskGuardPath)) { throw 'O encaminhador protegido do Ngrok nao foi encontrado.' }
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'scripts\check-ngrok-guard.mjs'))) { throw 'O teste de seguranca do Ngrok nao foi encontrado.' }

    & $taskNgrok.Source config check
    if ($LASTEXITCODE -ne 0) { throw 'A configuracao do Ngrok esta invalida. Confira o authtoken com ngrok config check.' }

    & $taskPowerShell.Source -NoProfile -ExecutionPolicy Bypass -File (Join-Path $taskRoot 'scripts\start-local.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'O EndoCare local precisa estar pronto antes de abrir o tunel.' }

    $taskDeadline = [DateTime]::UtcNow.AddSeconds(15)
    $taskProxyReady = $false
    do {
        try {
            $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/health' -TimeoutSec 3
            $taskProxyReady = $taskHealth.service -eq 'endobot' -and $taskHealth.status -eq 'ok'
        } catch { $taskProxyReady = $false }
        if (-not $taskProxyReady) { Start-Sleep -Milliseconds 500 }
    } while (-not $taskProxyReady -and [DateTime]::UtcNow -lt $taskDeadline)
    if (-not $taskProxyReady) { throw 'O proxy /api do Vite nao respondeu. Reinicie o EndoCare e tente novamente.' }

    New-Item -ItemType Directory -Path $taskStateDirectory -Force | Out-Null
    if (Get-NetTCPConnection -State Listen -LocalPort $taskGuardPort -ErrorAction SilentlyContinue) {
        throw "A porta $taskGuardPort ja esta em uso. Encerre o processo anterior do Ngrok e tente novamente."
    }
    if (Get-NetTCPConnection -State Listen -LocalPort $taskInspectorPort -ErrorAction SilentlyContinue) {
        throw "A porta do inspetor Ngrok $taskInspectorPort ja esta em uso. Encerre outro agente Ngrok e tente novamente."
    }
    $taskRandomBytes = New-Object byte[] 16
    $taskCookieBytes = New-Object byte[] 32
    $taskRandomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $taskRandomGenerator.GetBytes($taskRandomBytes)
        $taskRandomGenerator.GetBytes($taskCookieBytes)
    } finally { $taskRandomGenerator.Dispose() }
    $taskPassword = [BitConverter]::ToString($taskRandomBytes).Replace('-', '').ToLowerInvariant()
    $taskCookie = [BitConverter]::ToString($taskCookieBytes).Replace('-', '').ToLowerInvariant()
    [IO.File]::WriteAllText($taskAccessPath, "Usuario: EndoCare`r`nSenha temporaria: $taskPassword`r`n", [Text.UTF8Encoding]::new($false))

    $env:ENDOCARE_NGROK_USER = 'EndoCare'
    $env:ENDOCARE_NGROK_PASSWORD = $taskPassword
    $env:ENDOCARE_NGROK_COOKIE = $taskCookie
    $env:ENDOCARE_NGROK_GUARD_PORT = [string]$taskGuardPort
    try {
        $taskGuardProcess = Start-Process -FilePath $taskNode.Source `
            -ArgumentList ('"' + $taskGuardPath + '"') `
            -WorkingDirectory $taskRoot `
            -WindowStyle Hidden `
            -PassThru `
            -RedirectStandardOutput (Join-Path $taskStateDirectory 'ngrok-guard.stdout.log') `
            -RedirectStandardError (Join-Path $taskStateDirectory 'ngrok-guard.stderr.log')
        & $taskNode.Source (Join-Path $taskRoot 'scripts\check-ngrok-guard.mjs')
        if ($LASTEXITCODE -ne 0) { throw 'A verificacao de seguranca do encaminhador local falhou.' }
    } finally {
        if ($null -eq $taskPreviousUser) { Remove-Item Env:ENDOCARE_NGROK_USER -ErrorAction SilentlyContinue }
        else { $env:ENDOCARE_NGROK_USER = $taskPreviousUser }
        if ($null -eq $taskPreviousPassword) { Remove-Item Env:ENDOCARE_NGROK_PASSWORD -ErrorAction SilentlyContinue }
        else { $env:ENDOCARE_NGROK_PASSWORD = $taskPreviousPassword }
        if ($null -eq $taskPreviousCookie) { Remove-Item Env:ENDOCARE_NGROK_COOKIE -ErrorAction SilentlyContinue }
        else { $env:ENDOCARE_NGROK_COOKIE = $taskPreviousCookie }
        Remove-Item Env:ENDOCARE_NGROK_GUARD_PORT -ErrorAction SilentlyContinue
    }

    Write-Host ''
    Write-Host 'Acesso remoto protegido por autenticacao local.' -ForegroundColor Green
    Write-Host 'Usuario: EndoCare'
    Write-Host "Senha temporaria: $taskPassword" -ForegroundColor Yellow
    Write-Host 'Obtendo URL HTTPS do Ngrok...'

    $taskNgrokProcess = Start-Process -FilePath $taskNgrok.Source `
        -ArgumentList "http $taskGuardPort" `
        -WorkingDirectory $taskRoot `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput (Join-Path $taskStateDirectory 'ngrok.stdout.log') `
        -RedirectStandardError (Join-Path $taskStateDirectory 'ngrok.stderr.log')

    $taskNgrokIdentity = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskNgrokProcess.Id)" -ErrorAction SilentlyContinue
    $taskGuardIdentity = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskGuardProcess.Id)" -ErrorAction SilentlyContinue
    if (-not $taskNgrokIdentity -or -not $taskGuardIdentity) { throw 'Nao foi possivel registrar os processos do tunel Ngrok.' }
    @{
        ngrokPid = [int]$taskNgrokIdentity.ProcessId
        ngrokCreationDateUtc = $taskNgrokIdentity.CreationDate.ToUniversalTime().ToString('o')
        ngrokExecutablePath = $taskNgrokIdentity.ExecutablePath
        guardPid = [int]$taskGuardIdentity.ProcessId
        guardCreationDateUtc = $taskGuardIdentity.CreationDate.ToUniversalTime().ToString('o')
        guardExecutablePath = $taskGuardIdentity.ExecutablePath
        guardScriptPath = $taskGuardPath
        localPort = $taskGuardPort
    } | ConvertTo-Json | Set-Content -LiteralPath $taskNgrokStatePath -Encoding utf8

    $taskTunnelUrl = $null
    $taskTunnelDeadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $taskNgrokProcess.Refresh()
        if ($taskNgrokProcess.HasExited) {
            $taskNgrokError = if (Test-Path -LiteralPath (Join-Path $taskStateDirectory 'ngrok.stderr.log')) { Get-Content -LiteralPath (Join-Path $taskStateDirectory 'ngrok.stderr.log') -Tail 8 } else { @() }
            throw ("Ngrok encerrou antes de publicar a URL. " + ($taskNgrokError -join ' '))
        }
        try {
            $taskTunnels = Invoke-RestMethod -Uri "http://127.0.0.1:$taskInspectorPort/api/tunnels" -TimeoutSec 2
            $taskTunnel = $taskTunnels.tunnels | Where-Object { $_.proto -eq 'https' -and $_.config.addr -match ':5174$' } | Select-Object -First 1
            if ($taskTunnel) { $taskTunnelUrl = $taskTunnel.public_url }
        } catch { }
        if (-not $taskTunnelUrl) { Start-Sleep -Seconds 1 }
    } while (-not $taskTunnelUrl -and [DateTime]::UtcNow -lt $taskTunnelDeadline)
    if (-not $taskTunnelUrl) { throw 'Ngrok nao disponibilizou a URL HTTPS em 30 segundos.' }

    Write-Host ''
    Write-Host "Acesso remoto: $taskTunnelUrl" -ForegroundColor Green
    Write-Host 'Informe esse endereco, o usuario EndoCare e a senha temporaria acima no outro computador.'
    Write-Host 'Mantenha esta janela aberta enquanto usar o acesso remoto. Ctrl+C encerra o tunel.'
    Write-Host ''

    while (-not $taskNgrokProcess.HasExited) {
        Start-Sleep -Seconds 1
        $taskNgrokProcess.Refresh()
    }
    if ($taskNgrokProcess.ExitCode -ne 0 -and $taskGuardProcess -and -not $taskGuardProcess.HasExited) {
        throw 'Ngrok encerrou com erro. Confira .local-run\ngrok.stderr.log.'
    }
} catch {
    Write-Host ('Falha ao iniciar acesso Ngrok: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    Remove-Item -LiteralPath $taskAccessPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $taskNgrokStatePath -Force -ErrorAction SilentlyContinue
    if ($taskNgrokProcess -and -not $taskNgrokProcess.HasExited) {
        Stop-Process -Id $taskNgrokProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($taskGuardProcess -and -not $taskGuardProcess.HasExited) {
        Stop-Process -Id $taskGuardProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
