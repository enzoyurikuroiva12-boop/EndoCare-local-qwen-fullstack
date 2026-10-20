# Processo de criação do EndoCare

Este documento reúne o que os arquivos Markdown do repositório registram sobre a origem, as decisões, a arquitetura e a evolução do EndoCare. As datas e funcionalidades abaixo vêm principalmente do changelog; os guias técnicos descrevem os fluxos de autenticação, conhecimento do EndoBot, supervisão humana, voz e instalação local.

## Propósito e ponto de partida

O EndoCare foi criado como um site educativo e acolhedor sobre endometriose. A ideia central, conforme registrada no changelog, é ajudar a pessoa a encontrar informação geral, acompanhar sintomas e preparar perguntas para uma consulta, sem apresentar o site como ferramenta de diagnóstico, prescrição ou substituto de atendimento profissional.

A primeira fundação registrada é de **18 de agosto de 2026**. Ela já reunia uma homepage editorial, navegação por áreas do site, conteúdo sobre fitoterapia, um diário local de sintomas, o EndoBot, um blog e uma área de relatos com consentimento. O aviso de segurança clínica e a orientação para não compartilhar dados pessoais faziam parte dessa base desde o início.

Os documentos não descrevem entrevistas com pacientes, estudos clínicos próprios ou um processo formal de pesquisa com usuários. Por isso, este histórico relata o que está documentado no repositório e não atribui ao projeto métodos ou validações que os arquivos não comprovam.

## Referências e princípios de conteúdo

O produto foi organizado em torno de informação educativa, acolhimento, acessibilidade, transparência e privacidade. As páginas públicas explicam o propósito do site; o Diário, o Questionário, o EndoBot e a Administração recebem proteções próprias e não são tratados como conteúdo público para indexação.

Em 27 de agosto, o changelog registra uma pesquisa de palavras-chave voltada ao Brasil, organizada em **300 termos e cinco grupos temáticos**. Métricas que a fonte consultada não fornecia — como volume, custo por clique e dificuldade — foram marcadas como não disponíveis, em vez de estimadas. Essa pesquisa orientou caminhos editoriais sobre sintomas, dor pélvica, exames, diagnóstico, tipos de endometriose, fertilidade e vida cotidiana. O conteúdo mantém o aviso de que leitura educativa não substitui consulta, diagnóstico, prescrição ou atendimento de urgência.

O EndoBot também tem um acervo interno de referência. O guia de RAG descreve arquivos JSON no Supabase Storage, carregados e divididos em trechos para recuperar somente partes relacionadas à pergunta. Na auditoria registrada em 10 de outubro de 2026, o acervo tinha 19 arquivos e 5.298 registros textuais. Esse número é um retrato daquela auditoria, não uma garantia de que o conteúdo ou a contagem permaneçam iguais. A presença de um acervo não equivale, por si só, a revisão clínica independente de cada resposta.

## Como o site foi construído

O frontend usa **React 19, TypeScript e Vite**, com estilos em **Tailwind CSS 4**. O código está em `frontend/`. A interface começou com identidade visual própria e foi refinada ao longo dos registros: páginas responsivas, navegação em português, inglês e espanhol, blog em formato editorial, ilustrações botânicas, animações com respeito à preferência por movimento reduzido e recursos de acessibilidade, incluindo integração com VLibras.

O changelog mostra uma evolução em etapas: a fundação das páginas e recursos; a expansão de idiomas, autenticação e Administração; a produção de conteúdo em vídeo, FAQ e documentos legais; e, depois, ajustes de segurança, acessibilidade, responsividade e descoberta pública. O blog, o Diário, o Questionário, o EndoBot e os painéis administrativos foram ganhando fluxos e permissões específicos, em vez de serem expostos como uma única área sem distinção.

O backend está em `backend/`. O projeto usa Node.js e TypeScript, com endpoints para as funções do site. **Há dois modos de IA registrados nos documentos:** o histórico da versão publicada registra uma API implantada na Vercel, com OpenRouter como provedor principal do EndoBot e NVIDIA como alternativa; o modo local descrito no README usa **Qwen 2.5 3B pelo Ollama**, acessível em `127.0.0.1:11434`, com a API local em `127.0.0.1:3000`. O frontend local é servido pelo Vite em `127.0.0.1:5173`. O modo local é iniciado pelos arquivos `.bat` da raiz e não exige chave de API de IA para o Qwen.

O **Supabase** fornece autenticação e serviços de dados configurados para a aplicação, incluindo Storage para o acervo do EndoBot. As migrações SQL do projeto definem estruturas e regras de acesso. A instalação depende de credenciais locais configuradas conforme os arquivos `.env.example`; os `.env` reais não pertencem ao repositório. A chave `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas no backend.

## Recursos principais e decisões de segurança

- **Conteúdo público:** homepage, Blog, FAQ, Termos de Uso e Política de Privacidade. O sitemap e as descrições de busca incluem as páginas públicas e deixam fora Diário, Questionário, Administração e API.
- **Diário de sintomas:** permite registrar informações como data, intensidade da dor, humor, sangramento, medicação e notas. O changelog o descreve como diário pessoal; não como diagnóstico automatizado.
- **Questionário e relatos:** os registros passam por limites e controles administrativos. A triagem automática de relatos ajuda a organizar a revisão, mas não publica, rejeita nem pune automaticamente; decisões de moderação continuam humanas.
- **Autenticação:** o guia descreve cadastro com e-mail e senha, confirmação de conta por link, recuperação de senha e aceite de Termos e Privacidade. As mensagens de erro são genéricas para não revelar se uma conta existe.
- **EndoBot e supervisão humana:** mensagens passam por validações no backend; respostas automáticas e humanas têm papéis distintos. A fila humana é protegida por permissões e funções do banco, e a auditoria registra ações sem copiar o conteúdo da conversa.
- **Privacidade:** consentimento ou aviso de acompanhamento é limitado à conversa e pode ser revogado conforme os fluxos descritos. O changelog registra uma mudança de política em 31 de agosto: o checkbox inicial foi substituído por um aviso visível para novas conversas autenticadas. O guia de supervisão ainda descreve o fluxo anterior de aceite específico; essa diferença entre os documentos deve ser conferida antes de usar o guia como instrução operacional.

Essas decisões refletem um princípio repetido nos documentos: proteger conteúdo de saúde, não expor segredos no navegador e deixar claras as limitações da IA. As credenciais ficam no servidor ou em arquivos locais ignorados pelo Git. Os fluxos de supervisão passam por autorização no banco, e respostas indisponíveis retornam mensagens controladas sem expor erros internos.

## Voz do EndoBot

O modo de voz foi registrado no changelog em 18 de setembro de 2026. A pessoa pode gravar uma pergunta e ouvir a resposta; a interface informa que a voz é gerada por IA e orienta a não compartilhar dados pessoais.

O guia local descreve **OmniVoice 0.2.1** para síntese em português com perfil feminino, sem clonagem de voz, e **faster-whisper 1.2.1** para reconhecer gravações. Esse serviço opcional roda em `127.0.0.1:7862`. A instalação local exige Python 3.12 e `uv`, além de downloads de modelos e dependências que ocupam aproximadamente 7 GB. O chat escrito continua funcionando sem a instalação de voz.

## Sistema de desenvolvimento e execução

Os guias do repositório descrevem **Node.js 20 ou superior** e **pnpm** para instalar e executar a aplicação. No Windows, os arquivos `.bat` automatizam a instalação, a inicialização e o encerramento do frontend, backend local e, opcionalmente, serviço de voz. O Ollama fornece o modelo Qwen local. Para acessar o ambiente local de outro computador, o README documenta um túnel HTTPS pelo Ngrok, protegido por credenciais temporárias.

As alterações de frontend foram acompanhadas no `CHANGELOG.md` com registros de correções, recursos, segurança e validações. As etapas descritas incluem testes automatizados, checagem de tipos e build. Os arquivos de instalação ajudam a repetir o ambiente, mas o uso real ainda depende das credenciais do Supabase configuradas no computador.

## Linha do tempo registrada

- **18/08/2026:** fundação do frontend, identidade visual inicial, páginas educativas, Diário, EndoBot, Blog e relatos.
- **19–22/08/2026:** expansão para três idiomas, autenticação, conta, conteúdo em vídeo, acessibilidade, Diário em página própria e ferramentas administrativas.
- **25–27/08/2026:** consolidação de páginas legais, segurança e permissões administrativas, melhorias no EndoBot e supervisão humana.
- **28–31/08/2026:** triagem conservadora de relatos, SEO, fallback NVIDIA e atualização das regras de transparência da supervisão.
- **18/09/2026:** inclusão de gravação e reprodução de voz no EndoBot.
- **08/10/2026:** registro de uma cópia local com Qwen/Ollama e scripts para execução independente da versão publicada.

## Limites do que este histórico afirma

Este relato foi montado a partir dos seis arquivos Markdown versionados listados abaixo e complementado pela configuração de pacotes para identificar a stack. Ele explica as decisões e os sistemas registrados, mas não certifica o estado atual de serviços externos, credenciais, banco de produção ou implantação. Também não afirma que respostas de IA sejam orientação médica: o EndoCare é um recurso educativo e deve encaminhar dúvidas clínicas à equipe de saúde da pessoa.

## Arquivos consultados

- [README.md](README.md) — instalação, serviços locais, configuração, Ngrok e privacidade.
- [frontend/CHANGELOG.md](frontend/CHANGELOG.md) — histórico de recursos, correções, decisões e validações.
- [frontend/CONFIGURAR_AUTENTICACAO.md](frontend/CONFIGURAR_AUTENTICACAO.md) — login, cadastro, confirmação e recuperação de conta.
- [frontend/ENDOBOT_SUPERVISAO_HUMANA.md](frontend/ENDOBOT_SUPERVISAO_HUMANA.md) — regras documentadas para supervisão e controles de acesso.
- [backend/README_RAG.md](backend/README_RAG.md) — acervo de referência e recuperação de contexto do EndoBot.
- [backend/local-voice/README.md](backend/local-voice/README.md) — síntese e reconhecimento de voz locais.
