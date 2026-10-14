@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama nao encontrado. Execute INSTALAR_BACKEND_QWEN.bat primeiro.
  pause
  exit /b 1
)
if not exist "backend\.env" (
  echo Crie backend\.env a partir de backend\.env.example e preencha o Supabase.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\start-ollama.ps1"
if errorlevel 1 (
  echo O Ollama nao respondeu. Confira se a porta 11434 esta disponivel.
  pause
  exit /b 1
)
if exist "%~dp0backend\local-voice\.venv\Scripts\python.exe" (
  echo Iniciando voz local OmniVoice...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\local-voice\Start-OmniVoice.ps1"
  if errorlevel 1 echo A voz local ainda nao esta pronta. O chat de texto continuara disponivel.
) else (
  echo Voz local opcional: execute INSTALAR_VOZ_OMNIVOICE.bat para instalar o OmniVoice.
)
echo Backend local: http://127.0.0.1:3000
cd /d "%~dp0backend"
node "%~dp0backend\scripts\start-local.mjs"
if errorlevel 1 (
  echo O backend nao foi iniciado. Confira a mensagem acima.
  pause
  exit /b 1
)
