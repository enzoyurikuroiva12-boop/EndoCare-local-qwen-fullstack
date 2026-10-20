# EndoCare local

Aplicação EndoCare com frontend e backend local no mesmo repositório:

- frontend/: interface web, chat EndoBot e migrações do frontend.
- backend/: API local com Qwen via Ollama, integração Supabase e serviço opcional de voz OmniVoice.
- Arquivos .bat na raiz: instalação, inicialização e encerramento.

## O que instalar separadamente

1. **Node.js 20 ou superior** — https://nodejs.org/
2. **Ollama para Windows** — https://ollama.com/download/windows. O instalador do backend baixa o modelo qwen2.5:3b.
3. **Conta/projeto Supabase** — configure as credenciais somente nos arquivos locais descritos abaixo.
4. **Git for Windows** — necessário para clonar; não é necessário se você baixar o ZIP pelo GitHub.
5. **Opcional: voz OmniVoice** — Python 3.12 e uv no PATH. O instalador baixa PyTorch e modelos de voz/reconhecimento; reserve cerca de 7 GB.

O pnpm é instalado ou reparado pelos instaladores .bat. Não é necessário instalar Vercel CLI nem fornecer chave de API de IA para usar o Qwen local.

## Instalação

1. Baixe ou clone este repositório.
2. Execute INSTALAR_ENDOCARE.bat e INSTALAR_BACKEND_QWEN.bat, aguardando cada instalador terminar.
3. Preencha os arquivos locais:
   - frontend/.env: URL do Supabase e chave pública anon/publishable. Use frontend/.env.example como modelo.
   - backend/.env: URL do Supabase e SUPABASE_SERVICE_ROLE_KEY, além das opções locais do Qwen. Use backend/.env.example como modelo.
4. Execute INICIAR_ENDOCARE.bat. Abra http://127.0.0.1:5173.
5. Para encerrar os serviços iniciados pelo EndoCare, execute ENCERRAR_ENDOCARE.bat.

Para instalar a voz, instale Python 3.12 e uv, depois execute INSTALAR_VOZ_OMNIVOICE.bat. Ela é opcional: o chat de texto funciona sem esse serviço.

## Acesso por outro computador com Ngrok

1. Instale o Ngrok para Windows em https://ngrok.com/download/windows e configure seu token uma vez no terminal com `ngrok config add-authtoken SEU_TOKEN`. O token fica na configuração local do Ngrok; não o coloque no GitHub.
2. Execute `INICIAR_ENDOCARE_NGROK.bat`. O script inicia ou reutiliza o EndoCare local e abre um túnel HTTPS para o frontend, encaminhando a API ao backend local.
3. No outro computador, abra o endereço HTTPS mostrado no terminal e entre com o usuário `EndoCare` e a senha temporária exibida ali.

No primeiro acesso, o Ngrok pode mostrar uma tela informativa; confirme que deseja continuar e depois informe as credenciais do EndoCare. Mantenha a janela do terminal aberta durante o acesso. `Ctrl+C` ou `ENCERRAR_ENDOCARE.bat` encerra o túnel e os serviços locais. A próxima execução gera uma senha nova. Compartilhe o endereço e a senha apenas com quem deve acessar o ambiente. [Sobre o aviso do Ngrok](https://ngrok.com/abuse#browser-warning).

## Configuração local

Os arquivos .env não fazem parte do repositório. Não publique nem compartilhe esses arquivos. A chave SUPABASE_SERVICE_ROLE_KEY deve existir apenas em backend/.env no computador local e nunca no frontend. Os arquivos .env.example contêm somente marcadores fictícios.

O backend local usa qwen2.5:3b pelo Ollama em 127.0.0.1:11434. O frontend usa 127.0.0.1:3000 para a API local; o Vite atende a interface em 127.0.0.1:5173. A voz local OmniVoice atende em 127.0.0.1:7862.

As migrações SQL estão em frontend/supabase/migrations/ e backend/supabase/. Revise e aplique apenas as migrações necessárias no projeto Supabase correto.

## Privacidade

Não coloque chaves, tokens, dados de pacientes, conversas reais ou gravações no GitHub. Os diretórios de dependências, ambientes Python, modelos baixados, logs e áudios gerados são ignorados pelo Git.
