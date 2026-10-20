@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================
echo EndoCare - iniciar
echo ================================================
echo 1 - Iniciar para uso neste computador
echo 2 - Iniciar com acesso remoto protegido por Ngrok
echo.
choice /C 12 /N /M "Escolha 1 ou 2: "
if errorlevel 2 goto :ngrok
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
set "END_RESULT=%ERRORLEVEL%"
goto :done
:ngrok
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-ngrok.ps1"
set "END_RESULT=%ERRORLEVEL%"
:done
echo.
if not "%END_RESULT%"=="0" echo A inicializacao falhou. Confira a mensagem acima.
if "%END_RESULT%"=="0" echo Para parar os servicos, execute ENCERRAR_ENDOCARE.bat.
pause
exit /b %END_RESULT%
