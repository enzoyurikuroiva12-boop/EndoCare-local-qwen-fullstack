@echo off
setlocal EnableExtensions
cd /d "%~dp0"
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
call pnpm.cmd --version
if errorlevel 1 goto :error
if not exist "frontend\.env" copy /Y "frontend\.env.example" "frontend\.env" >nul
cd frontend
call pnpm.cmd install
if errorlevel 1 goto :error
echo Dependencias do frontend instaladas.
echo Configure frontend\.env com o Supabase antes de iniciar.
pause
exit /b 0
:error
echo A instalacao falhou.
pause
exit /b 1
