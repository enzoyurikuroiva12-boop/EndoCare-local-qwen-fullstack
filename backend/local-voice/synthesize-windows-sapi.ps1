param([switch]$ListPtBrFemaleVoices)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voices = @($synthesizer.GetInstalledVoices() | Where-Object {
        $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'pt-BR' -and
        $_.VoiceInfo.Gender.ToString() -eq 'Female'
    })

    if ($ListPtBrFemaleVoices) {
        $voice = $voices | Sort-Object @{ Expression = {
            if ($_.VoiceInfo.Name -eq 'Microsoft Maria') { 0 }
            elseif ($_.VoiceInfo.Name -eq 'Microsoft Maria Desktop') { 1 }
            else { 2 }
        } } | Select-Object -First 1
        if ($voice) { [Console]::Out.Write($voice.VoiceInfo.Name) }
        exit 0
    }

    $voiceName = $env:ENDOCARE_SAPI_VOICE
    $voice = $voices | Where-Object { $_.VoiceInfo.Name -eq $voiceName } | Select-Object -First 1
    if (-not $voice) { throw 'A voz feminina pt-BR selecionada nao esta instalada.' }
    if (-not $env:ENDOCARE_TTS_OUTPUT) { throw 'O caminho de saida WAV nao foi informado.' }

    $encodedText = [Console]::In.ReadToEnd().Trim()
    if (-not $encodedText) { throw 'O texto para sintese esta vazio.' }
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedText))
    if (-not $text) { throw 'O texto para sintese esta vazio.' }

    $synthesizer.SelectVoice($voiceName)
    $synthesizer.SetOutputToWaveFile($env:ENDOCARE_TTS_OUTPUT)
    $synthesizer.Speak($text)
    $synthesizer.SetOutputToNull()
} finally {
    $synthesizer.Dispose()
}
