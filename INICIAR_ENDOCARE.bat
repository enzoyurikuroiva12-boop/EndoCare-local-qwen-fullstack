@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 (
  echo EndoCare nao ficou pronto. Confira a causa e os arquivos de log indicados acima.
  pause
  exit /b 1
)
echo Frontend local: http://127.0.0.1:5173
echo Backend local: http://127.0.0.1:3000
echo Os servicos continuam ativos depois de fechar esta janela.
echo Para encerrar, execute ENCERRAR_ENDOCARE.bat.
pause
exit /b 0
