$ErrorActionPreference = 'Stop'
$taskVoiceRoot = $PSScriptRoot
$taskPython = Join-Path $taskVoiceRoot '.venv\Scripts\python.exe'
$taskServer = Join-Path $taskVoiceRoot 'server.py'
$taskSapiScript = Join-Path $taskVoiceRoot 'synthesize-windows-sapi.ps1'
if (-not (Test-Path -LiteralPath $taskPython)) {
    throw 'O servico de voz ainda nao foi instalado. Execute BAIXAR_ENDOCARE.bat e aceite a opcao de voz.'
}
$taskWindowsVoice = ''
if (Test-Path -LiteralPath $taskSapiScript) {
    $taskWindowsVoice = (& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $taskSapiScript -ListPtBrFemaleVoices 2>$null | Out-String).Trim()
}
$taskRequiredModules = @('fastapi', 'faster_whisper', 'numpy', 'soundfile', 'huggingface_hub', 'pydantic')
if (-not $taskWindowsVoice) { $taskRequiredModules += @('torch', 'omnivoice') }
$taskModuleCheck = $taskRequiredModules | ForEach-Object { "importlib.util.find_spec('$_') is not None" }
$taskCheckCode = "import importlib.util,sys; sys.exit(0 if all([$($taskModuleCheck -join ',')]) else 1)"
& $taskPython -c $taskCheckCode
if ($LASTEXITCODE -ne 0) { throw 'A instalacao da voz esta incompleta. Execute BAIXAR_ENDOCARE.bat e aceite a opcao de voz.' }
$taskListener = Get-NetTCPConnection -LocalPort 7862 -State Listen -ErrorAction SilentlyContinue
if ($taskListener) {
    try { $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:7862/health' -TimeoutSec 5 }
    catch { throw 'A porta 7862 esta ocupada por um programa que nao responde como o servico de voz local.' }
    if ($taskHealth.service -ne 'endobot-local-voice') { throw 'A porta 7862 ja esta ocupada por outro programa.' }
    $taskExpectedEngine = if ($taskWindowsVoice) { 'windows-sapi-pt-BR' } else { 'omnivoice' }
    if ($taskHealth.ttsEngine -eq $taskExpectedEngine) {
        Write-Host ('Voz local ja iniciada: ' + $taskExpectedEngine + ', estado: ' + $taskHealth.tts)
        exit 0
    }

    # Older service processes do not report ttsEngine and keep using OmniVoice.
    # Restart only the verified local voice service so the selected pt-BR voice takes effect.
    $taskStalePid = $taskListener[0].OwningProcess
    Write-Host ('Atualizando o servico antigo para a voz ' + $taskExpectedEngine + '...')
    Stop-Process -Id $taskStalePid -Force
    for ($taskWait = 0; $taskWait -lt 20; $taskWait++) {
        Start-Sleep -Milliseconds 250
        if (-not (Get-NetTCPConnection -LocalPort 7862 -State Listen -ErrorAction SilentlyContinue)) { break }
    }
    if (Get-NetTCPConnection -LocalPort 7862 -State Listen -ErrorAction SilentlyContinue) {
        throw 'O servico antigo da voz nao liberou a porta 7862.'
    }
}
$taskVoiceProcess = Start-Process -FilePath $taskPython -ArgumentList @('-u', ('"' + $taskServer + '"')) -WorkingDirectory $taskVoiceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskVoiceRoot 'stdout.log') -RedirectStandardError (Join-Path $taskVoiceRoot 'stderr.log')
$taskVoiceProcess.Id | Set-Content -LiteralPath (Join-Path $taskVoiceRoot 'server.pid') -Encoding ascii
$taskVoiceLabel = if ($taskWindowsVoice) { $taskWindowsVoice } else { 'OmniVoice' }
Write-Host ('Servico de voz iniciado em http://127.0.0.1:7862, voz: ' + $taskVoiceLabel + ' (PID ' + $taskVoiceProcess.Id + ').')
