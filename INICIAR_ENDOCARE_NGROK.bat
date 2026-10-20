@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where ngrok.exe >nul 2>nul
if errorlevel 1 (
  echo Ngrok nao encontrado. Instale em https://ngrok.com/download/windows e configure seu authtoken.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ngrok.ps1"
set "END_RESULT=%ERRORLEVEL%"
if not "%END_RESULT%"=="0" (
  echo O tunel Ngrok foi encerrado ou encontrou um erro.
  pause
)
exit /b %END_RESULT%
