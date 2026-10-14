@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================
echo EndoCare - encerrar servicos locais
echo ================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local.ps1" %*
set "END_RESULT=%ERRORLEVEL%"
echo.
if not "%END_RESULT%"=="0" echo Alguns processos nao puderam ser encerrados. Confira a mensagem acima.
pause
exit /b %END_RESULT%
