@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ================================================
echo EndoCare - instalacao do backend local Qwen
echo ================================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 20 ou superior em https://nodejs.org/
  pause
  exit /b 1
)
call pnpm.cmd --version >nul 2>nul
if errorlevel 1 (
  echo Instalando ou reparando pnpm 10.4.1...
  call npm.cmd install --global pnpm@10.4.1
  if errorlevel 1 goto :error
)
call pnpm.cmd --version >nul 2>nul
if errorlevel 1 goto :error
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama nao encontrado. Instale-o em https://ollama.com/download/windows
  echo Depois execute este arquivo novamente.
  pause
  exit /b 1
)
if not exist "backend\.env" copy /Y "backend\.env.example" "backend\.env" >nul
cd backend
call pnpm.cmd install --frozen-lockfile
if errorlevel 1 goto :error
node --import tsx -e "process.exit(0)" >nul 2>nul
if errorlevel 1 (
  echo A instalacao das dependencias ficou incompleta. Reparando os pacotes do backend...
  call pnpm.cmd install --force --frozen-lockfile
  if errorlevel 1 goto :error
)
node --import tsx -e "process.exit(0)" >nul 2>nul
if errorlevel 1 (
  echo O pacote tsx ainda nao pode ser carregado. Confira a instalacao do Node.js e do pnpm.
  goto :error
)
ollama list >nul 2>nul
if errorlevel 1 (
  echo Iniciando o servico Ollama...
  powershell.exe -NoProfile -Command "$ErrorActionPreference = 'Stop'; Start-Process -FilePath (Get-Command ollama.exe -ErrorAction Stop).Source -ArgumentList 'serve' -WindowStyle Hidden; for ($ollamaAttempt = 0; $ollamaAttempt -lt 30; $ollamaAttempt++) { try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; Write-Error 'Ollama nao iniciou na porta 11434.'; exit 1"
  if errorlevel 1 goto :error
)
ollama pull qwen2.5:3b
if errorlevel 1 goto :error
echo.
echo Instalacao concluida. Edite backend\.env com as variaveis Supabase antes de iniciar.
pause
exit /b 0
:error
echo A instalacao falhou. Confira a mensagem acima.
pause
exit /b 1
