$ErrorActionPreference = 'Stop'
$taskOllamaUrl = 'http://127.0.0.1:11434'
$taskStateDirectory = Join-Path $PSScriptRoot '..\.local-run'
$taskStateFile = Join-Path $taskStateDirectory 'ollama-process.json'

function Test-EndoCareOllama {
    try {
        $taskTags = Invoke-RestMethod -Uri "$taskOllamaUrl/api/tags" -TimeoutSec 2
        return $taskTags.PSObject.Properties.Name -contains 'models'
    } catch { return $false }
}

if (Test-EndoCareOllama) {
    Write-Host 'Ollama local ja esta disponivel em 127.0.0.1:11434.'
    exit 0
}
$taskPort = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue
if ($taskPort) { throw 'A porta 11434 esta ocupada, mas o Ollama local nao responde. Confira esse servico.' }

$taskOllamaExecutable = (Get-Command ollama.exe -ErrorAction Stop).Source
# Somente este processo filho usa o servidor local do EndoCare, mesmo que outra
# aplicacao tenha configurado OLLAMA_HOST para uma porta diferente.
$env:OLLAMA_HOST = '127.0.0.1:11434'
$taskOllamaProcess = Start-Process -FilePath $taskOllamaExecutable -ArgumentList 'serve' -WindowStyle Hidden -PassThru
$taskCim = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskOllamaProcess.Id)"
if (-not $taskCim) { throw 'O Ollama encerrou durante a inicializacao.' }
New-Item -ItemType Directory -Path $taskStateDirectory -Force | Out-Null
@{
    pid = $taskOllamaProcess.Id
    creationDateUtc = $taskCim.CreationDate.ToUniversalTime().ToString('o')
    executablePath = $taskCim.ExecutablePath
    host = '127.0.0.1:11434'
} | ConvertTo-Json | Set-Content -LiteralPath $taskStateFile -Encoding utf8

for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    if (Test-EndoCareOllama) {
        Write-Host "Ollama local iniciado em 127.0.0.1:11434 (PID $($taskOllamaProcess.Id))."
        exit 0
    }
    if ($taskOllamaProcess.HasExited) { throw 'O Ollama encerrou durante a inicializacao.' }
    Start-Sleep -Seconds 1
}
throw 'O Ollama ainda nao respondeu na porta 11434. Execute ENCERRAR_ENDOCARE.bat antes de tentar novamente.'
