$ErrorActionPreference = 'Stop'
$taskVoiceRoot = $PSScriptRoot
$env:UV_CACHE_DIR = Join-Path $env:LOCALAPPDATA 'uv\cache'
$env:UV_LINK_MODE = 'copy'
$taskPython = Join-Path $taskVoiceRoot '.venv\Scripts\python.exe'
$taskUvCommand = Get-Command uv.exe -ErrorAction SilentlyContinue
if (-not $taskUvCommand) {
    $taskUvCandidate = Join-Path $env:USERPROFILE '.local\bin\uv.exe'
    if (Test-Path -LiteralPath $taskUvCandidate) { $taskUvPath = $taskUvCandidate }
    else { throw 'Instale uv e Python 3.12 antes de instalar a voz local. https://docs.astral.sh/uv/getting-started/installation/' }
} else { $taskUvPath = $taskUvCommand.Source }

if (-not (Test-Path -LiteralPath $taskPython)) {
    & $taskUvPath venv --python 3.12 (Join-Path $taskVoiceRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel criar o ambiente Python 3.12 para OmniVoice.' }
}
Write-Host 'Instalando PyTorch CUDA e OmniVoice no ambiente isolado local-voice\.venv...'
& $taskUvPath pip install --no-cache --python $taskPython --index-url 'https://download.pytorch.org/whl/cu128' 'torch==2.8.0+cu128' 'torchaudio==2.8.0+cu128'
if ($LASTEXITCODE -ne 0) { throw 'A instalacao do PyTorch falhou.' }
& $taskUvPath pip install --python $taskPython --requirement (Join-Path $taskVoiceRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'A instalacao do OmniVoice falhou.' }
Write-Host 'Baixando os modelos oficiais OmniVoice e Whisper (aproximadamente 3.5 GB)...'
& $taskPython (Join-Path $taskVoiceRoot 'server.py') --download-only
if ($LASTEXITCODE -ne 0) { throw 'O download dos modelos de voz falhou.' }
Write-Host 'Voz local instalada. Execute INICIAR_VOZ_OMNIVOICE.bat ou o iniciador do EndoCare.'
