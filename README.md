# EndoCare local

Aplicação EndoCare com frontend e backend local no mesmo repositório:

- `frontend/`: interface web, chat EndoBot e migrações do frontend.
- `backend/`: API local com Qwen via Ollama, integração Supabase e serviço opcional de voz OmniVoice.

## Pré-requisitos

1. **Node.js 20 ou superior** — https://nodejs.org/
2. **Ollama para Windows** — https://ollama.com/download/windows. O instalador do EndoCare baixa o modelo `qwen2.5:3b`.
3. **Conta/projeto Supabase** — configure as credenciais somente nos arquivos locais descritos abaixo.
4. **Git for Windows** — necessário para clonar; não é necessário se você baixar o ZIP pelo GitHub.
5. **Opcional: voz OmniVoice** — Python 3.12 e `uv` no PATH. Os modelos e PyTorch ocupam cerca de 7 GB.
6. **Opcional: acesso remoto** — agente Ngrok para Windows e authtoken da sua conta: https://ngrok.com/download/windows.

O instalador configura `pnpm` na versão fixada pelo projeto. Não é necessário instalar Vercel CLI nem fornecer chave de API de IA para usar o Qwen local.

## Os três arquivos .bat

- `BAIXAR_ENDOCARE.bat`: instala dependências de frontend e backend, baixa `qwen2.5:3b` e oferece a instalação opcional do OmniVoice. O Ollama iniciado apenas para o download é encerrado ao fim; se já estava ativo, é preservado.
- `INICIAR_ENDOCARE.bat`: permite escolher o uso local ou o acesso remoto protegido por Ngrok. Frontend e backend ficam disponíveis em `http://127.0.0.1:5173` e `http://127.0.0.1:3000`.
- `ENCERRAR_ENDOCARE.bat`: encerra os serviços EndoCare identificados, incluindo frontend, backend, voz, Ollama iniciado pelo EndoCare e túnel Ngrok.

## Instalação e uso

1. Baixe ou clone este repositório.
2. Instale Node.js e Ollama pelos links acima.
3. Execute `BAIXAR_ENDOCARE.bat` uma vez. Responda `s` à pergunta sobre OmniVoice apenas se quiser baixar a voz; são cerca de 7 GB e requer Python 3.12 e `uv`.
4. Preencha os arquivos locais:
   - `frontend/.env`: URL do Supabase e chave pública anon/publishable. Use `frontend/.env.example` como modelo.
   - `backend/.env`: URL do Supabase e `SUPABASE_SERVICE_ROLE_KEY`, além das opções locais do Qwen. Use `backend/.env.example` como modelo.
5. Execute `INICIAR_ENDOCARE.bat` e selecione `1` para uso neste computador. Abra `http://127.0.0.1:5173`.
6. Para encerrar os serviços, execute `ENCERRAR_ENDOCARE.bat`.

O chat de texto pode funcionar sem OmniVoice. O EndoCare inicia a voz automaticamente se ela foi instalada.

## Acesso por outro computador com Ngrok

1. Instale Ngrok para Windows e configure seu token uma vez no terminal com `ngrok config add-authtoken SEU_TOKEN`. O token fica na configuração local do Ngrok; não o coloque no GitHub.
2. Na conta Ngrok, reserve o domínio `endocare.ngrok.app` em **Domains**. O plano da conta precisa permitir escolher esse domínio Ngrok; contas que só têm um domínio de desenvolvimento atribuído não podem escolher esse nome. O CLI exige que o domínio já esteja reservado para a conta.
3. Execute `INICIAR_ENDOCARE.bat` e selecione `2`. O EndoCare inicia os serviços locais e abre o túnel HTTPS em `https://endocare.ngrok.app`, encaminhando a API ao backend local.
4. No outro computador, abra o endereço HTTPS e use o usuário `EndoCare` e a senha temporária exibidos no terminal.

Se seu domínio reservado tiver outro nome, defina `ENDOCARE_NGROK_DOMAIN` no ambiente do Windows com o host reservado (sem `https://`); o padrão do iniciador é `endocare.ngrok.app`.

No primeiro acesso, o Ngrok pode mostrar uma tela informativa; confirme que deseja continuar e informe as credenciais do EndoCare. Mantenha a janela aberta enquanto usar o acesso remoto. `Ctrl+C` encerra o túnel; execute também `ENCERRAR_ENDOCARE.bat` para parar os serviços locais. Uma nova execução gera outra senha temporária. Compartilhe o endereço e a senha apenas com quem deve acessar o ambiente. [Sobre o aviso do Ngrok](https://ngrok.com/abuse#browser-warning).

## Configuração local

Os arquivos `.env` não fazem parte do repositório. Não publique nem compartilhe esses arquivos. A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas em `backend/.env` no computador local e nunca no frontend. Os arquivos `.env.example` contêm somente marcadores fictícios.

O backend local usa `qwen2.5:3b` pelo Ollama em `127.0.0.1:11434`. O frontend usa `127.0.0.1:3000` para a API local; o Vite atende a interface em `127.0.0.1:5173`. A voz local OmniVoice atende em `127.0.0.1:7862`.

As migrações SQL estão em `frontend/supabase/migrations/` e `backend/supabase/`. Revise e aplique apenas as migrações necessárias no projeto Supabase correto.

## Privacidade

Não coloque chaves, tokens, dados de pacientes, conversas reais ou gravações no GitHub. Os diretórios de dependências, ambientes Python, modelos baixados, logs e áudios gerados são ignorados pelo Git.
