$ErrorActionPreference = 'Stop'
$taskVoiceRoot = $PSScriptRoot
$taskPython = Join-Path $taskVoiceRoot '.venv\Scripts\python.exe'
$taskServer = Join-Path $taskVoiceRoot 'server.py'
if (-not (Test-Path -LiteralPath $taskPython)) {
    throw 'OmniVoice ainda nao instalado. Execute BAIXAR_ENDOCARE.bat e aceite a opcao de voz.'
}
& $taskPython -c "import importlib.util,sys; sys.exit(0 if all(importlib.util.find_spec(name) for name in ['torch','omnivoice','fastapi','faster_whisper']) else 1)"
if ($LASTEXITCODE -ne 0) { throw 'A instalacao da voz esta incompleta. Execute BAIXAR_ENDOCARE.bat e aceite a opcao de voz.' }
$taskListener = Get-NetTCPConnection -LocalPort 7862 -State Listen -ErrorAction SilentlyContinue
if ($taskListener) {
    try { $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:7862/health' -TimeoutSec 5 }
    catch { throw 'A porta 7862 esta ocupada por um programa que nao responde como OmniVoice.' }
    if ($taskHealth.service -ne 'endobot-local-voice') { throw 'A porta 7862 ja esta ocupada por outro programa.' }
    Write-Host ('OmniVoice local ja iniciado: ' + $taskHealth.status + ', dispositivo: ' + $taskHealth.device)
    exit 0
}
$taskVoiceProcess = Start-Process -FilePath $taskPython -ArgumentList @('-u', ('"' + $taskServer + '"')) -WorkingDirectory $taskVoiceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskVoiceRoot 'stdout.log') -RedirectStandardError (Join-Path $taskVoiceRoot 'stderr.log')
$taskVoiceProcess.Id | Set-Content -LiteralPath (Join-Path $taskVoiceRoot 'server.pid') -Encoding ascii
Write-Host ('OmniVoice iniciado em http://127.0.0.1:7862 (PID ' + $taskVoiceProcess.Id + '). Os modelos serao carregados em alguns instantes.')
