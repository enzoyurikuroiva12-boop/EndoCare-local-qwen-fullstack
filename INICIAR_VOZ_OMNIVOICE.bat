@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\local-voice\Start-OmniVoice.ps1"
if errorlevel 1 (
  echo Nao foi possivel iniciar a voz. Confira a mensagem acima.
  pause
  exit /b 1
)
pause
