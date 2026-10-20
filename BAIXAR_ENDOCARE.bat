@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================
echo EndoCare - baixar e instalar
echo ================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-local.ps1"
set "END_RESULT=%ERRORLEVEL%"
echo.
if not "%END_RESULT%"=="0" echo A instalacao falhou. Confira a mensagem acima.
pause
exit /b %END_RESULT%
