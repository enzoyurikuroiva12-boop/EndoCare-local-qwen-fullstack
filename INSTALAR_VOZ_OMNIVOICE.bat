@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================
echo EndoCare - instalacao da voz local OmniVoice
echo ================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\local-voice\Install-OmniVoice.ps1"
if errorlevel 1 (
  echo A instalacao da voz falhou. Confira a mensagem acima.
  pause
  exit /b 1
)
pause
