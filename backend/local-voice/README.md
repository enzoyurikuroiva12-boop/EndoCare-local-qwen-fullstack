# Voz local do EndoBot

O serviço usa **OmniVoice 0.2.1**, com o modelo oficial `k2-fsa/OmniVoice`, para sintetizar voz feminina em português. O perfil usa os atributos oficiais `female, middle-aged, moderate pitch` e velocidade `0.95`. O reconhecimento das gravações usa **faster-whisper 1.2.1 / Whisper base**, em CPU int8. Nenhuma chave OpenAI é necessária e nenhuma voz pessoal é clonada.

Execute `INSTALAR_VOZ_OMNIVOICE.bat` uma vez na raiz do backend. A instalação cria um ambiente isolado Python 3.12, instala PyTorch 2.8.0 CUDA 12.8 e baixa os modelos em `local-voice/models/`. Os downloads iniciais totalizam aproximadamente 7 GB incluindo o PyTorch. Dependências e revisões dos modelos estão fixadas em `requirements.txt` e `server.py`.

Pré-requisitos do instalador: **Python 3.12** e **uv** no PATH (ou `uv.exe` em `%USERPROFILE%\.local\bin`). Neste computador já estão instalados. A instalação usa CUDA somente quando disponível; a versão de PyAV está fixada em `16.1.0` para compatibilidade com o faster-whisper.

Execute `INICIAR_VOZ_OMNIVOICE.bat`, ou use o iniciador integrado do EndoCare. O serviço escuta exclusivamente em `http://127.0.0.1:7862`. Consulte `/health` para distinguir `loading`, `ready` e `error`; `device` mostra o dispositivo do modelo principal e `decoderDevice` o dispositivo do decodificador de áudio. Ao compartilhar uma GPU de 8 GB com o Qwen, o modo automático pode manter o modelo principal da voz na GPU e o decodificador na CPU. Quando falta memória, usa CPU. Para escolher manualmente, defina `OMNIVOICE_DEVICE=cpu` ou `cuda:0` no ambiente **antes** de iniciar o serviço Python.

O frontend chama `POST /api/endobot-tts` com `{ "text": "Olá!", "preferredLanguage": "pt" }` e recebe `{ "audioBase64": "...", "audioMimeType": "audio/wav", "provider": "omnivoice", "voice": "female" }`. A rota `/api/endobot-voice` reconhece áudio localmente. O frontend usa `transcribeOnly: true` para receber `{ "transcript": "..." }`, salvar a pergunta na conversa e chamar a rota de chat autenticada normalmente. O parâmetro `generateAudio: false` continua disponível para clientes anteriores que desejam ASR e chat juntos. A síntese ocorre em uma chamada separada para que o texto apareça antes do áudio. Problemas de TTS são exibidos explicitamente e o texto permanece disponível.

Limites: texto até 6.000 caracteres na GPU e **300 caracteres na CPU**; gravação até 8 MB / 65 segundos; uma síntese de voz por vez. Se a GPU ficar sem memória e o serviço precisar migrar para CPU, o limite menor também se aplica antes de tentar novamente. Textos maiores recebem HTTP 413 e a interface orienta pedir uma resposta mais curta; nenhuma resposta é truncada. O serviço não registra texto de perguntas nem gravações. `stdout.log`, `stderr.log` e `server.pid` ficam ao lado de `server.py`. Os modelos permanecem no disco ao encerrar o serviço.

O perfil GPU usa FP16 e 16 passos. O perfil CPU usa FP32, 8 passos e até 6 threads, também ao recuperar falta de memória CUDA. A quantização int8 do OmniVoice foi testada e descartada porque alterou o conteúdo falado; ela não é usada no serviço. O Whisper continua em CPU int8, conforme o modelo próprio de reconhecimento.

Neste computador (RTX 3070 de 8 GB / Ryzen 5 3500), com o Qwen residente na GPU, a chamada HTTP de voz completou 139 palavras / 885 caracteres em **13,95 s**, produzindo 60,50 s de áudio. Uma frase de 14 palavras levou 6,52 s na GPU e **13,39 s na CPU**, com transcrição local correta. A mesma resposta longa na CPU não terminou dentro do prazo de 180 s, inclusive em uma passagem única; por isso o modo CPU é reservado a trechos curtos. O limite de 6.000 caracteres na GPU é um limite de entrada, não uma medição de desempenho para essa extensão. As alocações CUDA temporárias são liberadas após cada síntese para compartilhar memória com o Qwen.

Teste completo com fala produzida pelo próprio modelo (sem microfone ou dados pessoais):

```powershell
backend\local-voice\.venv\Scripts\python.exe backend\local-voice\server.py --smoke-test
```

Esse teste gera `omnivoice-test.wav` e verifica a fala com o Whisper local. Execute-o com o serviço de voz encerrado para evitar carregar duas cópias do modelo.

Fontes oficiais: [OmniVoice](https://github.com/k2-fsa/OmniVoice), [atributos de voz](https://github.com/k2-fsa/OmniVoice/blob/master/docs/voice-design.md), [modelo](https://huggingface.co/k2-fsa/OmniVoice), [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
