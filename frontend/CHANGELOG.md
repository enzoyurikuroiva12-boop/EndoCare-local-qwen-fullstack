# Changelog — Frontend EndoCare

Este documento reúne as principais adições e mudanças do **frontend** desde a criação do projeto. Ele cobre a pasta `frontend/` e é baseado no código atual e nos marcos registrados na branch `main`.

> **Escopo atual:** as mudanças são mantidas no repositório GitHub. Este arquivo não representa um histórico de deploys.

> **Regra de manutenção:** toda mudança relevante no frontend deve incluir uma atualização neste arquivo no mesmo commit, antes da sincronização com o GitHub.

## 2026-08-27 — Exclusão segura no chat e carregamento silencioso da manutenção

### Adicionado

- Cada administradora com acesso ao **Chat da equipe** pode apagar somente mensagens que ela própria enviou. O Dono também pode apagar mensagens de outras pessoas da equipe; o botão é discreto, localizado em português, inglês e espanhol e exige confirmação antes da ação.
- A migração `20260827_admin_chat_message_deletion.sql` cria uma auditoria privada de exclusão que conserva somente identificadores técnicos, ator, remetente original, ação e data. Ela não armazena o corpo, menções nem cópia de nenhuma mensagem.
- A autorização efetiva está na RPC `delete_endoacolhe_admin_chat_message(uuid)`: ela repete a validação de sessão, permissão de chat e regra autor/Dono no banco. Não há exclusão direta concedida ao cliente.
- O canal Realtime do chat passou a tratar eventos `DELETE`, removendo a mensagem apagada da tela das demais sessões sem recarregar o painel.

### Corrigido

- A faixa global de manutenção agora inicia em estado desconhecido e fica totalmente oculta até a RPC confirmar que a manutenção está ativa. Em caso de falha na leitura, ela continua oculta; a atualização local feita pelo Dono segue imediata. Isso elimina o flash amarelo indevido no carregamento normal.

### Validado

- Type-check, build de produção, verificação de whitespace e suíte Vitest concluídos com **122 testes em 38 arquivos**. O aviso de chunk acima de 500 KB permanece somente informativo.
- A migração de exclusão foi aplicada no Supabase ativo. O advisor de segurança foi revisado: o aviso informativo de RLS sem policy na auditoria é intencional, pois a tabela está sem grants e sem acesso direto; a nova RPC exige `authenticated`, mas valida autorização internamente antes de alterar dados.

**Publicação:** commit `d99d420`, enviado para `origin/main`; deployment de produção `dpl_BagyoNh1fs6HtdvcXgK1ZF8VkHhn` confirmado como `READY`.

---

## 2026-08-27 — Rótulo de login restaurado no desktop

### Corrigido

- O botão de entrada no computador voltou a mostrar o ícone e o texto **Logar**. A regra final substitui a compactação aplicada a larguras intermediárias e garante largura suficiente para o rótulo, sem afetar o menu em telas de até 900 px.
- O avatar sem texto continua exclusivo da conta já autenticada; o ajuste não modifica a abertura do login, a sessão, o perfil nem os atalhos administrativos.

### Validado

- Type-check, build de produção, verificação de whitespace e suíte Vitest foram concluídos com **118 testes em 37 arquivos**. O aviso de bundle acima de 500 KB permanece informativo.

---

## 2026-08-27 — Alinhamento de atalhos compactos no menu mobile

### Corrigido

- Os atalhos compactos de conta e Administração dentro do menu de três traços agora ficam alinhados à direita em telas de até 900 px, sem alargar os blocos, cortar texto ou provocar rolagem horizontal.
- O ajuste é limitado à área de ações do menu. Os cards editoriais, formulários e blocos de leitura continuam ocupando a largura segura da tela.

### Aplicativo Android relacionado

- O upload de foto do aplicativo foi corrigido para usar `File` e `ArrayBuffer`, em vez de enviar `Blob` diretamente ao Storage. Isso segue a compatibilidade indicada pelo Supabase para React Native e mantém sessão, tipo, tamanho, diretório privado e limpeza em caso de falha.[1]

**Publicação:** commit `6c33bc4`, enviado para `origin/main`; deployment de produção `dpl_HaLbkjS3p7MEX2uXxZpECEwbVrVZ` confirmado como `READY`.

[1]: https://supabase.com/docs/reference/javascript/storage-from-upload "Supabase Storage — Upload de arquivo em React Native"

---

## 2026-08-27 — Atalho de perfil compacto e upload de foto reforçado

### Corrigido

- O atalho de conta passou a exibir somente o avatar no desktop e no menu responsivo. Ele continua abrindo as configurações da conta e preserva rótulo acessível e tooltip; o ícone de engrenagem e o texto visível foram removidos.
- O fluxo de foto agora confirma a sessão imediatamente antes do envio, cria um arquivo WebP explícito a partir do recorte e usa seu tipo MIME no upload ao bucket privado.
- Se a atualização do metadata da conta falhar após o upload, o arquivo recém-enviado é removido do bucket, evitando foto órfã. Falhas de sessão, recorte sem conteúdo ou formato inesperado continuam bloqueando a operação de forma segura.

### Verificado

- A migração `profile_photos` está aplicada no Supabase, com bucket privado de 5 MB e formatos JPEG, PNG e WebP. As quatro políticas de Storage continuam limitadas ao diretório que corresponde à pessoa autenticada.
- Type-check, build e suíte Vitest foram aprovados com **118 testes em 37 arquivos**. O aviso de bundle acima de 500 KB permanece apenas informativo.

**Publicação:** commit `ff85b89`, enviado para `origin/main`; deployment de produção `dpl_EeX7tm1GVG98cevGTZvVUnWWrLXD` confirmado como `READY`.

---

## 2026-08-27 — Questionário com tradução automática

### Alterado

- O formulário de criação e edição de perguntas no Admin agora mostra somente **Pergunta em português** e **Orientação em português**. Os campos manuais de inglês e espanhol foram removidos da interface.
- Ao salvar, o site solicita traduções estruturadas ao endpoint administrativo protegido e persiste as versões em inglês e espanhol junto da versão em português. A página pública continua exibindo a versão correspondente ao idioma selecionado, com fallback para português apenas em registros antigos sem tradução.
- O botão apresenta o estado textual de tradução antes de gravar e a lista administrativa informa que os outros idiomas são atualizados automaticamente.

### Segurança

- A tradução não é chamada pelo navegador sem sessão: o endpoint exige origem oficial, sessão válida, permissão de Dono/Admin, senha adicional do painel e limites de conteúdo. Nenhuma chave do provedor de IA foi adicionada ao frontend.
- Em falha de tradução, a pergunta não é salva parcialmente. A pessoa administradora recebe orientação para tentar novamente.

**Publicação:** frontend no commit `c5b3243`, deployment de produção `dpl_EbSX1VBnnCbf8CPtD9oSh3k78kf1` em `READY`; backend no commit `126294c`, deployment de produção `dpl_DPnC5TjHbdR7r3ybgsRGUptBUt6C` em `READY`.

---

## 2026-08-27 — Pesquisa de palavras-chave e SEO educativo no Brasil

### Pesquisa e conteúdo

- Pesquisa estruturada com foco no Brasil e fontes públicas: 300 palavras-chave em cinco clusters, distribuídas na planilha `docs/PESQUISA_PALAVRAS_CHAVE_ENDOACOLHE_BRASIL.xlsx` e documentadas em `docs/PESQUISA_PALAVRAS_CHAVE_ENDOACOLHE_BRASIL.md`.
- A planilha deixa como **N/D** volume, CPC, dificuldade, tráfego e autoridade de domínio, pois a fonte pública selecionada não fornece essas métricas. Nenhum dado estimado foi apresentado como métrica medida.
- Nova seção editorial na Home, localizada nos três idiomas, organiza caminhos de leitura sobre sintomas e dor pélvica, exames e diagnóstico, tipos de endometriose e fertilidade/vida cotidiana. Ela direciona apenas para FAQ e Blog públicos.

### SEO responsável

- Título, meta description, Open Graph e Twitter Card da Home foram atualizados para descrever endometriose, sintomas, dor pélvica, informação educativa e acolhimento de forma natural.
- Foi adicionado JSON-LD `WebSite` com descrição da superfície pública em português do Brasil.
- A implementação preserva o sitemap e robots existentes: não promove Diário, EndoBot, Questionário, Admin, API nem rotas privadas para indexação.
- O texto inclui aviso inequívoco de que a leitura não substitui consulta, diagnóstico, prescrição ou atendimento de urgência, sem prometer tratamento, cura ou resultado clínico.

**Publicação:** commit `6243caa`, enviado para `origin/main`; deployment de produção `dpl_Cv8mYW6maXt4SHhWp4GB9sdGSKyq` confirmado como `READY`.

---

## 2026-08-27 — Supervisão humana consentida do EndoBot

### Adicionado

- Opt-in separado, desmarcado por padrão e localizado em português, inglês e espanhol antes do primeiro envio de uma conversa autenticada. A autorização é limitada àquela conversa e pode ser retirada pela própria pessoa depois.
- Módulo **Supervisão humana do EndoBot** exclusivo do Dono no Admin já protegido por sessão, papel e senha adicional. A fila usa categoria, idioma, título, data, quantidade de mensagens e estado, sem mostrar e-mail, ID de conta, IP ou dados de punição.
- Pausa com confirmação antes da tomada humana; enquanto estiver pausada, a pessoa vê aviso textual e mensagens da **Equipe humana do EndoCare** ficam inequivocamente identificadas.
- Migrações aplicadas no Supabase para consentimento por conversa, estado reversível de pausa, auditoria sem cópia do texto, funções protegidas de listagem/resposta, limitação de papel de mensagem e sinal administrativo em tempo real.

### Segurança e privacidade

- A listagem, leitura, pausa e resposta passam por RPCs `security definer` que validam `is_endoacolhe_owner()`; não há uma política de SELECT direto para o Dono nas tabelas de conversas ou mensagens.
- A atualização em tempo real do painel usa somente `admin_realtime_signal`, sem conteúdo. O sinal é emitido somente para conversa com consentimento atual ou recém-revogado, impedindo que o painel receba até metadados de atividade de chats sem opt-in.
- Pessoas autenticadas só inserem mensagens com papel `user`. Respostas `assistant` são persistidas no backend, e papel `human` apenas pelo RPC do Dono após a pausa válida.
- O endpoint do EndoBot valida o UUID e a propriedade da conversa no servidor, verifica a pausa antes e depois da geração e não chama nem devolve resposta automática quando a equipe humana assumiu.

### Validado

- Type-check, build de produção e suíte Vitest do frontend concluídos com **115 testes** aprovados.
- Type-check e suíte Vitest do backend concluídos com **36 testes** aprovados e 2 integrações de fault injection opcionalmente puladas sem proxy local.
- O advisor de segurança foi revisado após as migrações. A execução pública da função interna de gatilho foi revogada; permanecem avisos preexistentes sobre tabelas deliberadamente fechadas por RLS e RPCs `security definer` com checagem interna de papel.

**Publicação:** implementação do site no commit `d971520`, deployment de produção `dpl_79fxXZwArFDm62AAymjUzD9PTWVH` e backend no commit `4bb85bc`, deployment `dpl_6RYvJTgY8rfmwG4m32rEdrpr3beg`, ambos confirmados como `READY`.

---

## 2026-08-26 — Mapa público para leitores de IA

### Adicionado

- `llms.txt` na raiz pública do domínio, em Markdown conciso e no formato proposto pela convenção `llms.txt`.
- `llms-full.txt` como contexto público ampliado, com propósito do EndoCare, superfícies canônicas e limites de interpretação.
- Links diretos apenas para Home, Blog, FAQ, Termos, Política de Privacidade, sitemap e diretivas de rastreamento.

### Segurança e contexto

- Os arquivos excluem Diário, Questionário, contas, suporte, EndoBot, administração, punições, métricas, URLs assinadas e qualquer conteúdo privado.
- O texto reforça que o conteúdo é educativo e não substitui diagnóstico, prescrição, tratamento individualizado ou urgência.
- A convenção melhora a descoberta e a leitura de contexto por agentes, mas não promete indexação, treinamento ou citação por sistemas de IA.

---

## 2026-08-26 — FAQ, documentos públicos e aceite no cadastro

### Adicionado

- Páginas públicas e localizadas de **FAQ**, **Termos de Uso** e **Política de Privacidade**, acessíveis em `/faq`, `/termos` e `/privacidade`.
- Links para os três documentos no rodapé compartilhado, sem inserir caminhos privados ou administrativos na navegação pública.
- Campos obrigatórios de aceite no cadastro: a criação da conta fica desabilitada até a leitura e confirmação de Termos e Privacidade.
- As versões vigentes e a origem `web` passam a acompanhar o metadata do novo cadastro, junto ao nome escolhido, sem inserir senhas ou conteúdo sensível.
- Migração `20260827_legal_acceptance.sql`, que define recibos imutáveis e separados para Termos e Privacidade, com RLS de leitura somente da própria conta.

### Segurança e privacidade

- O frontend bloqueia o envio sem os dois aceites; o Supabase recebe os indicadores e versões no próprio `signUp`.
- Os recibos projetados não registram IP, respostas de questionário, mensagens, Diário ou conteúdo do EndoBot.
- A aplicação da migração no Supabase permanece pendente de reautorização da integração de escrita; até lá, os metadados do cadastro preservam a evidência técnica do aceite enviado pelo site.

### SEO responsável

- O sitemap canônico passou a incluir as novas superfícies públicas de ajuda e transparência, mantendo excluídas as rotas de Diário, Questionário, Admin, API e fallback.

---

## 2026-08-26 — Rastreamento público e sitemap

### Adicionado

- `robots.txt` público com referência ao sitemap canônico do domínio de produção.
- `sitemap.xml` com as páginas públicas indexáveis: Home e Blog.

### Segurança e privacidade

- As rotas operacionais ou que dependem de sessão foram excluídas do rastreamento: `/admin`, `/admin/punicoes`, `/diario`, `/questionario`, `/404` e `/api/`.
- O sitemap não inclui URLs com dados pessoais, estados autenticados, endpoints ou recursos administrativos.

---

## 2026-08-26 — Controles de perfil e Administração compactos

### Corrigido

- No PC, o botão de conta agora mostra somente a foto de perfil, sem texto ou ícone adicional; o nome continua disponível em `aria-label` e tooltip.
- No celular, Administração agora aparece somente como o ícone de escudo, sem perder `aria-label` e tooltip para identificação e acessibilidade.
- A regra mobile foi reforçada para manter Administração em um botão quadrado de 42px, sem texto visível mesmo quando o menu usa estilos gerais de navegação.
- O cabeçalho mantém os controles dentro da largura visível, sem cortar ações ou alterar o acesso protegido por cargo.

### Validado

- Regressão estrutural adicionada para a contenção entre 901px e 1280px.

---

## 2026-08-26 — Limite semanal do questionário

### Adicionado

- O envio do questionário agora exige uma conta autenticada e fica limitado a uma resposta a cada 7 dias por pessoa.
- A interface informa o bloqueio, mostra a data de liberação e oferece o fluxo de login quando a pessoa ainda não entrou.
- O painel administrativo ganhou a ação protegida **Liberar questionário** por conta; o histórico anterior permanece preservado e cada reset é registrado para auditoria.
- A regra também é aplicada no Supabase por RPC e não depende de `localStorage`, permitindo que o bloqueio sobreviva à troca de navegador.

### Validado

- Migração `20260826_questionnaire_weekly_limit.sql` aplicada no projeto Supabase de produção.

---

## 2026-08-26 — Correção do topo na abertura mobile

### Corrigido

- O aviso de segurança e o cabeçalho agora usam offset zero quando a manutenção está desligada; a altura e o respiro da faixa só deslocam esses elementos quando a manutenção está ativa.
- A abertura do Questionário deixou de reservar espaço fantasma no topo, evitando que o cabeçalho invada o título e que a composição fique desalinhada no mobile.

### Validado

- Teste do componente atualizado para cobrir a regra condicional do tema.

---

## 2026-08-26 — Ajuste do aviso de manutenção

### Corrigido

- A faixa amarela de manutenção agora recebe o pequeno respiro superior somente quando está ativa; quando a manutenção está desligada, nenhum espaço ou linha residual é reservado no topo.
- O comportamento continua responsivo no mobile e preserva a hierarquia editorial do aviso.

### Validado

- Teste estrutural do estado ativo e do deslocamento condicional adicionado à suíte do componente.

---

## 2026-08-26 — Acesso ao painel administrativo

### Corrigido

- A autorização da rota `/admin` agora só começa depois que a sessão Supabase termina de ser restaurada. Isso evita que um administrador válido seja tratado como visitante e enviado para a Home ao abrir Administração.
- O bloqueio continua ativo para visitantes e contas sem cargo administrativo; a senha adicional do painel permanece obrigatória antes do carregamento do workspace protegido.

### Validado

- Teste de regressão para a ordem sessão → autorização adicionado à suíte do Admin.

---

## 2026-08-25 — Foto de perfil

### Adicionado

- A configuração da conta agora permite escolher, trocar e remover uma foto de perfil.
- Antes de salvar, o editor permite arrastar a imagem, ajustar o zoom e escolher as posições horizontal e vertical; o resultado é exportado como recorte quadrado de 512 × 512 px.
- Fotos aceitam somente JPG, PNG ou WebP até 5 MB e são armazenadas em bucket privado com caminho exclusivo por usuário.
- O cabeçalho exibe o avatar no desktop e dentro do menu mobile; sem foto, usa as iniciais da pessoa como fallback.
- A URL da imagem é assinada por tempo limitado e o metadata aceito é validado para não referenciar o diretório de outra conta.
- A migração `20260826_profile_photos.sql` cria o bucket e políticas RLS de insert, select, update e delete somente para o diretório do usuário autenticado.

### Corrigido

- A configuração da conta passou a atualizar o avatar após upload ou remoção sem exigir novo login, mantendo o editor aberto se o envio falhar para a pessoa não perder o enquadramento escolhido.

---

## 2026-08-25 — Menu mobile e acesso administrativo

### Corrigido

- **Configuração da conta** e **Administração** deixaram de ficar expostos fora do cabeçalho mobile e passaram a aparecer dentro do menu de três traços, com o login seguindo o mesmo fluxo quando a pessoa ainda não está autenticada.
- O Blog, o Diário, a Home e a página própria do Questionário passaram a compartilhar a mesma composição de ações, preservando os controles desktop e a validação do cargo administrativo.
- A checagem do `/admin` agora diferencia ausência real de cargo de erro temporário na consulta de autorização. Um administrador válido não é redirecionado por uma falha transitória e recebe uma tentativa segura de validação; a senha adicional continua obrigatória antes de carregar o workspace protegido.
- A leitura de cargos aceita apenas `owner`, `admin`, `moderator` e `support`, normalizando espaços e caixa sem ampliar permissões.

### Validado

- Suítes direcionadas: **20 testes aprovados em 6 arquivos**.
- Suíte completa: **32 arquivos e 93 testes aprovados**.
- `pnpm check`, `pnpm build` e `git diff --check` concluídos com sucesso; permanecem apenas os avisos conhecidos de analytics opcional e bundle acima de 500 KB.

---

## 2026-08-25 — Questionário em página própria

### Alterado

- O questionário público saiu da Home e passou a ser acessível em `/questionario`.
- O item **Questionário** da navegação agora abre a nova página, que ganhou cabeçalho, seletor de idioma e rodapé no mesmo padrão do Diário.
- As perguntas, respostas, avaliação de 1 a 5 estrelas, envio seguro e avisos de privacidade continuam usando o componente e o fluxo já existentes.
- A gestão das perguntas e o gráfico de avaliações permanecem protegidos no painel administrativo.

### Validado

- Testes estruturais da nova rota e da Home aprovados.
- Suíte completa: 32 arquivos e 92 testes aprovados com variáveis públicas fictícias de teste.
- `pnpm check`, `pnpm build` e `git diff --check` concluídos com sucesso; permanecem apenas os avisos conhecidos de analytics opcional e bundle acima de 500 KB.

---

## 2026-08-25 — Proteção de rota e responsividade do Admin

### Alterado

- A rota `/admin` agora redireciona para a página inicial quando a sessão não existe ou quando a pessoa autenticada não possui cargo administrativo válido.
- O redirect só acontece depois da conclusão do carregamento da sessão e da checagem de autorização, evitando flash da área protegida e mantendo a senha adicional para administradores autorizados.
- A navegação e os cartões do painel foram ajustados para telas estreitas, com grade segura, quebra de textos longos, contenção de grids/ações e remoção do overflow horizontal do painel.
- A paleta, a tipografia editorial, os cards acolhedores e os avisos responsáveis de saúde foram preservados.

### Validado

- `pnpm exec vitest run client/src/pages/Admin.test.ts` — 6 testes aprovados.
- `pnpm check`, `pnpm build` e `git diff --check` concluídos com sucesso. Os avisos existentes de analytics opcional e bundle acima de 500 KB permanecem não bloqueantes.

---

## 2026-08-25 — Atalho de Administração no mobile

### Alterado

- O botão **Administração** agora fica visível no cabeçalho mobile para administradores autorizados.
- Ele permanece separado do menu de três traços e da ação **Configuração da conta**.
- O componente continua escondendo o atalho para usuários sem papel administrativo válido.
- O rótulo ganhou um elemento próprio para controlar a quebra de texto em telas estreitas.

---

## 2026-08-25 — Login com e-mail e senha

### Alterado

- O login voltou a solicitar e-mail e senha por `signInWithPassword`, sem código ou magic link para o acesso normal.
- O magic link foi mantido somente para confirmação de cadastro e recuperação de senha.
- O diálogo foi atualizado nos três idiomas, com `current-password`, mensagens genéricas de erro e limitador `email-login`.
- A documentação de autenticação e o dossiê técnico foram alinhados ao comportamento atual.

---

## 2026-08-25 — Dossiê técnico completo do EndoCare

### Adicionado

- `DOCUMENTACAO_TECNICA_JUDICIAL_ENDOACOLHE.md` passa a reunir a descrição formal do produto, arquitetura, frontend, backend2, Supabase, banco, RLS, autenticação, privacidade, acessibilidade, segurança do EndoBot, testes, fault injection controlado, operação, deploy, rollback, evidências e pendências.
- O dossiê inclui um modelo obrigatório para registrar futuras mudanças com data, commit, arquivos, risco, validações e estado de produção.
- A documentação diferencia fatos verificados, amostras operacionais e itens pendentes de confirmação, sem armazenar segredos.

---

## 2026-08-25 — Documentação de continuidade para IA

### Adicionado

- `CONTEXTO_IA_ENDOACOLHE.md` reúne arquitetura, funcionalidades, segurança, integrações externas, comandos de validação, deploy, pendências e protocolo para outra IA continuar o projeto sem descontextualização.
- `PROMPTS_USADOS_ENDOACOLHE.md` registra as solicitações do usuário, decisões de produto e resultados relevantes até esta etapa.
- Os documentos não incluem prompts internos, chaves, tokens, senhas ou segredos.

---

## 2026-08-25 — Chat privado entre administradores

### Alterado

- O painel administrativo ganhou o **Chat da equipe**, uma conversa privada atualizada em tempo real entre as contas com permissão administrativa de suporte.
- Mensagens podem mencionar pessoas com `@usuario`; o banco valida os destinatários contra a equipe administrativa antes de salvar a menção.
- A pessoa mencionada recebe um aviso visual e um som curto configurável, com opção de ativar ou desativar o áudio no próprio painel.
- O chat usa limite de tamanho, RLS e funções protegidas para não expor mensagens ou o diretório administrativo a usuários comuns.
- A navegação lateral ganhou uma âncora exclusiva para o chat, mantendo o tema editorial e o comportamento responsivo do Admin.

### Validado

- Testes cobrem resolução de menções com acentos, pontuação, duplicidade e usuários desconhecidos.
- O type-check, o build de produção, o diff de whitespace e os advisors do Supabase foram executados.
- A migração `20260825_admin_private_chat.sql` foi aplicada no projeto Supabase ativo.

---

## 2026-08-25 — Configuração da conta no menu mobile

### Alterado

- O cabeçalho mobile passou a exibir um botão independente chamado **Configuração da conta** depois que a pessoa entra.
- O botão fica fora do menu de três traços e continua abrindo o diálogo existente de configurações, com etiqueta acessível e título explicativo.
- A largura e o texto foram ajustados para telas estreitas, com quebra controlada em até duas linhas sem empurrar o seletor de idioma ou o menu.
- Foram mantidas versões localizadas para português, inglês e espanhol.

### Validado

- O teste do Home cobre a existência do botão independente e sua regra de visibilidade mobile.
- A suíte de configurações da conta, o type-check e o diff de whitespace serão executados antes do commit.

---

## 2026-08-25 — Login por link mágico

### Alterado

- O login público deixou de pedir senha ou código manual: a pessoa informa o e-mail e recebe um link de acesso privado.
- A tela de confirmação orienta a abrir a caixa de entrada e clicar no link enviado, sem digitar código, com lembrete para verificar a pasta de spam.
- O cadastro continua usando senha e confirmação de e-mail; recuperação de senha permanece disponível separadamente.
- O reenvio do acesso passou a usar a chamada de magic link do Supabase e continua protegido pelo limite local de tentativas.

### Validado

- Foram atualizados os textos nos idiomas português, inglês e espanhol.
- O teste do diálogo passou a cobrir as instruções do link de acesso, e o identificador interno do limitador foi renomeado de `resend-code` para `resend-link`.
- Os testes e o type-check serão executados antes do commit.

---

## 2026-08-25 — Correção da faixa superior do Admin

### Corrigido

- A faixa de manutenção deixou de usar altura fixa, evitando ser comprimida em uma linha estreita quando o layout ou o viewport varia.
- A mensagem secundária da faixa passou a começar com letra maiúscula em português, inglês e espanhol.
- O espaçamento mínimo e a largura interna da faixa foram protegidos para manter o ícone, o título e o aviso legíveis em desktop e mobile.

### Validado

- Foi atualizado o teste da mensagem de manutenção para garantir a capitalização correta.
- Type-check, teste específico da faixa e build serão executados antes do commit.

---

## 2026-08-25 — Navegação e alinhamento do Diário

### Adicionado

- A página Diário ganhou uma navegação interna compacta com as visões **Resumo**, **Histórico** e **Gráficos**, sem transformar a experiência em um painel genérico.
- O Resumo apresenta registros feitos, dias anotados, dor média e os dados do último registro; Histórico mantém edição e exclusão; Gráficos concentra a evolução da dor nos últimos dez registros.

### Corrigido

- Os campos de data, humor, sangramento e medicação passaram a respeitar o próprio conteúdo, evitando que a dica da medicação estique um bloco e deixe os controles da mesma linha com alturas irregulares.
- O formulário recebeu cabeçalho, espaçamentos e alturas mínimas consistentes, com adaptação para telas pequenas e ações de histórico compactas no celular.

### Validado

- Foi adicionada cobertura unitária para média de dor, quantidade de registros, dias distintos e identificação do registro mais recente.
- O teste do componente passou com **2 testes**, o type-check passou e o build de produção foi concluído.

---

## 2026-08-25 — Correção de carregamento do VLibras

### Corrigido

- A política CSP passou a permitir os workers `blob:`, WebAssembly e os endpoints oficiais de tradução, dicionário e repositório usados pelo VLibras Widget v7.6, evitando que o painel fique preso na tela de carregamento.
- Foram preservados os hosts oficiais do script, frames e assets, sem liberar scripts inline.

### Validado

- A integração continua usando a marcação oficial `vw`, `vw-access-button` e `vw-plugin-wrapper`.
- O teste específico de acessibilidade passou com **4 testes**, o type-check passou e o build de produção foi concluído.

---

## 2026-08-25 — Controle de manutenção exclusivo do Dono

### Adicionado

- O painel Admin ganhou um cartão de manutenção visível somente para o Dono, com status do site e botão para ativar ou desativar a faixa amarela global.
- A faixa global passou a consultar o estado persistido e reage imediatamente à alternância feita pelo Dono, mantendo fallback ativo se a leitura pública falhar durante a edição.
- O estado foi persistido em `endoacolhe_site_settings`, com leitura pública limitada ao booleano de manutenção.

### Segurança

- A alteração só pode ser feita pelo RPC protegido por cargo de Dono e pela segunda etapa de acesso do Admin; a tabela não pode ser lida ou alterada diretamente por `anon` ou `authenticated`.
- O texto e o estilo da faixa foram mantidos na identidade visual editorial do EndoCare, com responsividade para telas pequenas.

### Validado

- TypeScript, build e teste específico da faixa passaram.
- As migrações `site_maintenance_control` e `site_maintenance_gate` foram aplicadas no projeto Supabase ativo; o estado inicial foi confirmado como ativo.

---

## 2026-08-25 — Hardening profundo do EndoBot

### Segurança

- O frontend continua exibindo no Admin somente fingerprints, categoria, severidade, risco, origem e sinais; nenhum texto original, segredo ou IP em claro é enviado para a interface administrativa.
- O painel usa o gate de segunda etapa e a revisão exclusiva do Dono para os eventos de segurança; a classificação detalhada mantém fallback seguro para registros antigos.

### Validado

- O backend foi endurecido para filtrar histórico, saídas do provedor, PII, credenciais rotuladas e conteúdo com obfuscação antes de chegar ao modelo.

---

## 2026-08-25 — Limpeza visual do chat administrativo

### Alterado

- Removida do chat administrativo a dica `Enter envia · Shift + Enter quebra a linha`, mantendo o campo, o envio e os atalhos de teclado funcionando normalmente.

### Validado

- TypeScript, build e verificação visual do formulário administrativo revisados após a remoção.

---

## 2026-08-25 — Proteção administrativa do EndoBot

### Adicionado

- A área de segurança do Admin agora apresenta categoria, severidade, pontuação de risco, origem e sinais detectados para pedidos de credenciais, prompt injection, fault injection, exfiltração, comandos destrutivos e saídas sensíveis.
- Os sinais recebem rótulos em português, inglês e espanhol, preservando a navegação administrativa existente.

### Segurança

- O painel continua visível e revisável somente pelo Dono; o frontend não recebe nem exibe a pergunta original, chaves, tokens, senhas ou IPs em claro.
- Eventos antigos sem a classificação nova usam um fallback seguro até a migração do Supabase ser aplicada.

### Validado

- TypeScript do frontend passou após a ampliação do tipo de evento e da renderização administrativa.

---

## 2026-08-25 — Sinalização de manutenção e indisponibilidade do EndoBot

### Adicionado

- A faixa global `Site em Manutenção algumas funções foram desabilitadas` agora aparece no topo do site com ícone de martelo, fundo amarelo e adaptação para desktop e mobile.
- A faixa permanece ativa durante a edição por uma constante explícita no código, sem depender de configuração da hospedagem; para encerrar o aviso, altere `maintenanceMode` para `false` em `MaintenanceBanner.tsx` quando o site sair de manutenção.

### Corrigido

- O EndoBot agora exibe `Indisponível` quando o endpoint de saúde falha ou não retorna o estado esperado, acompanhado de bolinha vermelha.
- O health check também reage ao retorno da conexão, e o campo de mensagem, as perguntas sugeridas e o envio ficam desabilitados enquanto o serviço estiver indisponível.
- Os offsets da Home foram ajustados para manter a faixa de manutenção, o aviso de segurança, a topbar e os links de âncora sem sobreposição.

### Validado

- `pnpm check` passou.
- Teste específico da faixa passou com **2 testes**.
- `pnpm build` passou; permanecem apenas os avisos já existentes de analytics sem variáveis e bundle acima de 500 KB.
- Revisão visual local confirmou o layout da Home em desktop e mobile e o estado indisponível do EndoBot. A suíte completa que importa o cliente Supabase exigiu as variáveis públicas do ambiente, ausentes neste shell.

---

## 2026-08-25 — Descrição SEO e metadados de descoberta

### Alterado

- O título da homepage foi ajustado para destacar **endometriose**, acolhimento e cuidado integrativo.
- A `meta description` agora descreve naturalmente informação sobre endometriose, saúde da mulher, autocuidado, diário de sintomas, fitoterapia e relatos da comunidade.
- Foram adicionados canonical, Open Graph e Twitter Card para manter uma descrição consistente em resultados e compartilhamentos.

### SEO responsável

- Não foi adicionada a antiga meta tag `keywords`, pois o Google informa que ela não é usada no ranking. As palavras-chave foram incorporadas à descrição e ao título em linguagem natural.

### Validado

- A descrição SEO ficou com **143 caracteres**, contém o tema principal do site e o canonical aponta para `https://endo-acolhe.vercel.app/`.
- TypeScript e build de produção foram aprovados.

---

## 2026-08-25 — Sincronização realtime do painel administrativo

### Adicionado

- O painel `/admin` agora acompanha mudanças administrativas por um canal realtime centralizado, sem exigir atualização manual da página.
- Contas, cargos, punições, relatos, artigos, segurança do EndoBot, atendimentos, questionário, avaliações e monitoramento são recarregados automaticamente quando há alteração no Supabase.
- O Log de punições em `/admin/punicoes` também passou a acompanhar o mesmo sinal realtime.
- A migração criou o `admin_realtime_signal`, uma tabela de sinal sem conteúdo sensível, e triggers por instrução nas tabelas administrativas relevantes. O painel recebe apenas a revisão e consulta os dados protegidos por RPC/RLS.

### Segurança e operação

- O sinal só pode ser lido por sessões administrativas que já passaram pela autenticação e pela etapa adicional de acesso do painel.
- O canal central evita expor respostas, mensagens, IPs, senhas ou outros dados privados em eventos realtime; cada atualização dispara uma nova leitura protegida conforme o cargo da sessão.
- O canal é encerrado quando a página, a sessão ou a autorização deixam de estar ativas.

### Validado

- A migração realtime foi aplicada no Supabase e confirmou a publicação de `admin_realtime_signal`, das perguntas e das respostas do questionário.
- TypeScript, build de produção e a suíte Vitest foram aprovados com **79 testes em 29 arquivos**.

---

## 2026-08-25 — Filtro de /404 e reset das métricas

### Corrigido

- A rota `/404` deixou de ser uma rota monitorada: não gera visualizações, sessões, engajamento ou erros técnicos e não aparece mais na lista de rotas do painel.
- O frontend e o backend agora rejeitam `/404` antes do envio da telemetria, enquanto a consulta agregada do Supabase também ignora registros dessa rota.
- Os registros históricos de `/404` foram removidos do banco na migração `20260825_site_monitoring_reset`.

### Adicionado

- O painel de **Monitoramento do site** agora exibe o botão **Resetar métricas** somente para o Dono.
- O reset exige confirmação explícita e apaga visualizações, sessões, engajamento e erros de navegação, preservando as ações administrativas no histórico de auditoria.
- A operação usa a função protegida `reset_endoacolhe_site_monitoring()` no Supabase, com verificação efetiva de Dono e permissões restritas a usuários autenticados.

### Validado

- O Supabase confirmou **0 eventos antigos em `/404`** e a existência da função protegida de reset.
- TypeScript do frontend e backend passaram; a suíte frontend passou com **78 testes em 29 arquivos** e a suíte backend com **29 testes em 11 arquivos**.
- O botão foi localizado no cabeçalho do monitoramento e permanece adaptável ao layout responsivo do painel.

---

## 2026-08-25 — Correção da integração oficial do VLibras

### Corrigido

- A árvore do VLibras passou a ser renderizada diretamente no JSX com os atributos oficiais `vw`, `vw-access-button` e `vw-plugin-wrapper`, desde a montagem inicial do React.
- O carregador passou a inserir `https://vlibras.gov.br/app/vlibras-plugin.js` no `head` e inicializar `new window.VLibras.Widget('https://vlibras.gov.br/app')` somente depois que a marcação oficial existe.
- Foi removido o evento `load` artificial e a camada de posicionamento que forçava `inset` e `position: fixed` sobre o root oficial. Agora o painel e o botão seguem o layout fornecido pelo próprio widget, com apenas o z-index necessário para não ficar atrás das superfícies do site.

### Acessibilidade e segurança

- A integração segue o snippet oficial de integração web do VLibras e mantém o botão, o menu, o avatar, a tradução, a velocidade e a emoção fornecidos pelo widget oficial.
- A política CSP existente continua limitada aos hosts oficiais do VLibras e às diretivas necessárias para script, conexão e frame, sem liberar execução inline ampla.

### Validado

- A prévia local confirmou a presença da árvore `[vw]`, do botão e do wrapper oficiais antes do carregamento; após o clique, o painel completo do VLibras v7.6.0 foi aberto com seus controles nativos.
- TypeScript, build de produção e a suíte Vitest completa foram aprovados com **77 testes em 29 arquivos**.
- A produção ainda não foi revalidada porque o domínio atual continua apontando para o deploy anterior enquanto o projeto Vercel correto não está acessível nesta sessão.

---

## 2026-08-25 — Questionário de experiência e avaliação do site

### Adicionado

- A homepage agora inclui a seção pública **Questionário de experiência**, com perguntas carregadas do Supabase, respostas em texto e avaliação final de 1 a 5 estrelas. A seção mantém a identidade visual editorial do EndoCare, é responsiva e está disponível em português, inglês e espanhol.
- O painel `/admin` agora possui **Questionário e avaliações**. Administradores e o Dono podem criar, editar, ordenar, ativar/desativar e definir perguntas como obrigatórias, incluindo textos de apoio e traduções.
- O painel administrativo exibe um gráfico agregado da distribuição de avaliações, a quantidade total recebida e a média geral. O gráfico não apresenta respostas escritas individuais e só aparece para cargos com permissão administrativa de resultados.

### Segurança e privacidade

- A nova migração criou tabelas separadas para perguntas e respostas, com RLS, limites de tamanho, validação de nota entre 1 e 5 e função protegida para receber respostas.
- O envio público passa por uma função `security definer` que aceita somente respostas relacionadas a perguntas ativas e não permite acesso direto às respostas pela API pública.
- A leitura das estatísticas é feita por uma função protegida que retorna somente agregados de avaliação para Admin e Dono. Moderador e Suporte não recebem acesso ao gerenciamento nem ao gráfico.

### Validado

- A migração `20260825_questionnaire_feedback` foi aplicada no Supabase de produção e confirmou três perguntas iniciais ativas.
- A seção pública foi conferida visualmente em prévia local com perguntas reais vindas do banco, navegação, cards responsivos e cinco estrelas.
- TypeScript, build de produção e a suíte Vitest completa foram aprovados com **77 testes em 29 arquivos**, usando as variáveis públicas do Supabase no ambiente de validação.

---

## 2026-08-22 — Endurecimento da política de scripts

### Segurança

- A diretiva `script-src` deixou de aceitar a execução ampla de scripts inline. O frontend continua a permitir somente seus próprios arquivos e as origens externas explicitamente necessárias para o VLibras e os recursos de implantação.
- A permissão para estilos inline permanece separada, pois a interface e os componentes visuais usam estilos calculados no navegador; essa exceção não autoriza a execução de JavaScript inline.

### Validado

- A página publicada não possui scripts ou atributos de evento inline. A política recebeu teste específico e o painel oficial do VLibras será revalidado após a publicação.

---

## 2026-08-22 — Inicialização tardia do VLibras

### Corrigido

- O carregador oficial do VLibras é agora acionado também quando o React monta o componente depois que a página já concluiu o carregamento. Isso respeita o ciclo de vida esperado pelo script oficial, que prepara o botão e o painel no evento `load` da janela.
- O atalho volta a receber a interface oficial de Libras em vez de permanecer apenas como uma superfície vazia.
- A política de segurança passou a autorizar de forma explícita o host complementar `www.vlibras.gov.br`, usado pelo módulo dinâmico oficial aberto após o clique, sem permitir origens genéricas adicionais.

### Validado

- TypeScript, build de produção e o teste específico da integração foram aprovados. A nova regra cobre os estados de documento já concluído, interativo e ainda carregando.

---

## 2026-08-22 — Carregamento oficial do VLibras

### Corrigido

- A integração deixou de depender da camada adicional que fechava o painel antes de o conteúdo de tradução estar disponível.
- O site agora monta a marcação indicada pelo VLibras e carrega diretamente o script oficial `vlibras-plugin.js`, com inicialização única do widget.
- Quando o script oficial realmente não puder ser obtido, a mensagem de acessibilidade oferece o botão **Tentar novamente**, em vez de fechar um painel que ainda está carregando.

### Validado

- TypeScript, build de produção, a suíte Vitest com **74 testes em 29 arquivos** e a verificação mecânica de interface foram aprovados antes da publicação.

---

## 2026-08-22 — Log de punições em área própria

### Alterado

- O **Log de punições** foi retirado do fluxo principal de gerenciamento de contas e passou a ter a rota exclusiva `/admin/punicoes`.
- A página própria mantém a senha adicional do painel, a validação por cargo e a atualização reativa quando um status de conta muda.
- O acesso continua disponível para Dono, Admin, Moderador e Suporte; pessoas sem permissão recebem uma tela de acesso restrito.

### Validado

- TypeScript, build de produção, a suíte Vitest com **74 testes em 29 arquivos** e a verificação mecânica de interface foram aprovados.

---

## 2026-08-22 — Mensagens por teclado e suporte reativo

### Corrigido

- Os compositores do EndoBot, do chat de suporte da pessoa usuária e da resposta administrativa agora usam a mesma regra: **Enter envia** e **Shift + Enter** cria uma nova linha.
- Campos editoriais, relatos, motivos administrativos e anotações do diário permanecem multilinha para não comprometer a escrita de conteúdos longos.
- O painel de suporte passou a usar uma assinatura dedicada e estável para alterações em conversas e mensagens. Novos atendimentos e novas mensagens atualizam a lista e o atendimento selecionado sem recarregar a página.

### Validado

- As tabelas privadas de conversas e mensagens de suporte foram confirmadas na publicação em tempo real do Supabase.
- TypeScript, build de produção, a suíte Vitest com **73 testes em 28 arquivos** e a verificação mecânica de interface foram aprovados.

---

## 2026-08-22 — Métricas públicas deduplicadas

### Corrigido

- Recarregamentos repetidos da mesma pessoa na mesma rota pública não somam novas visualizações durante a sessão do navegador.
- O painel `/admin` deixou de gerar visualizações, sessões, engajamento ou eventos de abertura na audiência pública.
- O cartão **Ações administrativas** agora apresenta somente ações reais registradas de controle de contas, conteúdo, senhas e cargos; abrir ou recarregar o painel não altera esse total.

### Validado

- A migração limpou a telemetria administrativa anterior e aplicou unicidade por tipo de evento, rota e sessão. A verificação posterior encontrou **0** eventos administrativos na audiência pública.
- TypeScript, build de produção, **71 testes frontend em 27 arquivos** e **29 testes backend em 11 arquivos** foram aprovados.

---

## 2026-08-22 — Confirmação de e-mail por link

### Corrigido

- O cadastro deixou de pedir um código de seis dígitos que não corresponde ao e-mail enviado. A interface agora informa claramente que um **link de confirmação** foi enviado ao e-mail cadastrado.
- O reenvio passou a reenviar o link de confirmação e o retorno ao site após abrir o link é direcionado à origem do EndoCare.
- Cada nova abertura do diálogo de acesso inicia em **Entrar na minha conta**. Assim, depois de sair, clicar em Logar não reabre mais o cadastro nem uma confirmação pendente.

### Validado

- TypeScript, build de produção, a suíte Vitest com **69 testes em 27 arquivos** e a verificação mecânica de interface foram aprovados.

---

## 2026-08-22 — Restauração de reputação exclusiva do Dono

### Adicionado

- O Dono passou a ter o controle **Restaurar reputação** em contas comuns que possuem histórico de punições. A ação exige digitar uma palavra de confirmação antes de remover o histórico usado no cálculo da reputação.
- Após a confirmação, o histórico de punições daquela pessoa é apagado e o indicador de reputação volta ao estado **Boa**.

### Segurança

- A operação é validada no banco por função protegida e exclusiva do Dono. Contas da equipe, a própria conta do Dono e contas sem histórico de punições não podem usar esse fluxo.
- A restauração **não** reativa uma conta nem remove uma restrição ou suspensão que ainda esteja ativa; esses controles continuam sendo gerenciados separadamente.

### Validado

- A migração foi aplicada no Supabase. TypeScript, build de produção, a suíte Vitest com **69 testes em 27 arquivos** e a verificação mecânica de interface foram aprovados.

---

## 2026-08-22 — Atalho Administração por cargo

### Corrigido

- O botão **Administração** do cabeçalho voltou a aparecer para pessoas autenticadas com os cargos Dono, Admin, Moderador ou Suporte.
- A visibilidade agora consulta exclusivamente o papel administrativo da conta. A segunda senha permanece exigida somente depois de abrir `/admin`, evitando que a própria proteção esconda o caminho de entrada.

### Validado

- A função de papel está liberada apenas para sessões autenticadas. TypeScript, build de produção e a suíte Vitest passaram com **67 testes em 27 arquivos**.

---

## 2026-08-22 — Hero responsiva em desktops largos

### Corrigido

- A área inicial da homepage deixou de ficar limitada a uma faixa central rígida em telas de desktop largas. A superfície visual agora ocupa a largura disponível, enquanto texto e painel permanecem centralizados em uma área de leitura equilibrada.
- A grade desktop passou a usar espaçamento lateral e distância entre colunas fluidos, preservando a hierarquia visual em resoluções como 1366×768 e sem alterar as regras específicas para mobile.

### Validado

- TypeScript, build de produção e a suíte Vitest passaram após a alteração. A regra foi verificada em prévia local de desktop, confirmando largura integral da hero, ausência de `max-width` rígido e colunas confortáveis para texto e painel.

---

## 2026-08-22 — Correção da senha adicional do painel

### Corrigido

- O verificador criptográfico da senha adicional de acesso ao painel `/admin` foi reparado com bcrypt compatível com a função de validação do banco. O botão **Administração** e a segunda etapa de acesso foram preservados.

### Validado

- A correspondência entre a senha configurada e o verificador armazenado foi confirmada no banco de produção. TypeScript e a suíte Vitest passaram com **65 testes em 27 arquivos**.

---

## 2026-08-22 — Artigo fixado no Blog

### Adicionado

- Administradores com permissão de gestão do Blog passaram a poder **fixar no topo** ou desafixar um artigo já publicado diretamente na lista de artigos recentes do painel `/admin`.
- O Blog público prioriza o artigo fixado antes dos demais e mostra a indicação localizada de **Em destaque**; os outros artigos continuam ordenados pela publicação mais recente.

### Segurança e consistência

- O banco permite somente **um** artigo fixado por vez. Fixar outro artigo substitui automaticamente o destaque anterior, e rascunhos não podem permanecer fixados.
- A ação usa uma função protegida pela mesma permissão administrativa de gestão do Blog.

### Validado

- TypeScript, build de produção e a suíte Vitest com **64 testes em 27 arquivos** foram aprovados. A restrição de artigo fixado único foi confirmada no banco de produção.

---

## 2026-08-22 — Monitoramento de acessos e engajamento

### Adicionado

- O site passou a registrar telemetria mínima de navegação: visualização de rota, 15 segundos de permanência, profundidade de rolagem, erros técnicos e abertura do painel administrativo.
- O painel `/admin` agora inclui a seção **Monitoramento do site**, exclusiva do Dono, com filtros de 7 ou 30 dias, série de acessos e sessões engajadas, rotas mais acessadas e totais de ações administrativas.

### Privacidade e segurança

- Não são armazenados senhas, conteúdo do EndoBot, textos de relatos, e-mails, identificadores de conta nem IPs em texto aberto. Cada sessão de monitoramento usa um identificador efêmero no navegador.
- Os eventos ficam em tabela sem leitura direta pelo frontend, com retenção máxima de 90 dias. O painel recebe apenas agregações por uma consulta protegida exclusiva do Dono.

### Validado

- TypeScript e build de produção foram aprovados. A suíte Vitest do frontend passou com **62 testes em 26 arquivos**; o backend passou com **28 testes em 11 arquivos**. A rota administrativa permaneceu protegida para sessão não autenticada.

---

## 2026-08-22 — Proteção adicional do painel e campos de senha

### Adicionado

- O painel `/admin` agora exige uma segunda etapa de acesso com senha adicional, validada no banco por verificador criptográfico e limitada a uma sessão de **12 horas**. A proteção também passou a ser conferida pelos endpoints administrativos sensíveis.
- Todos os campos que recebem senha no login, cadastro, configurações de conta e redefinição administrativa receberam o botão acessível para **mostrar ou ocultar** o valor em digitação.

### Corrigido

- A redefinição direta de senha do painel mantém a validação clara **“As senhas não coincidem.”** antes de enviar qualquer alteração.

### Segurança

- Senhas existentes permanecem irrecuperáveis e não são exibidas, inclusive para o Dono. Como alternativa segura, o Dono pode criar uma senha temporária e auditada para contas de equipe, inclusive Admin, exceto para a própria conta de Dono.

### Validado

- TypeScript e build de produção foram aprovados. A suíte Vitest do frontend passou com **59 testes em 24 arquivos**; o backend passou com **25 testes em 10 arquivos**. A alternância Mostrar/Ocultar foi conferida em prévia local.

---

## 2026-08-22 — Ajustes de relatos, diário e disponibilidade

### Corrigido

- O contador de relatos publicados passou a ocupar a extremidade esquerda do cabeçalho da área de relatos.
- Cada item de **Registros recentes** agora exibe a ação textual **“Reabrir registro”**, que preenche o formulário com os dados salvos e ativa o modo de edição.
- Uma falha no envio de uma pergunta agora muda imediatamente o indicador do EndoBot para **“indisponível / em manutenção”**, com o estado vermelho já previsto na interface. Uma resposta posterior restaura o estado disponível.

### Revisado

- Foram confirmadas as cópias já aderentes ao pedido: **EndoCare** com E e A maiúsculos, crédito para **alunos do SESI**, e a faixa superior do vídeo contendo apenas a duração. A nota de áudio abaixo do vídeo foi preservada.

### Validado

- TypeScript, build de produção e a suíte Vitest com **57 testes em 24 arquivos** foram aprovados. A reabertura de registro e o estado indisponível foram verificados em prévia local.

---

## 2026-08-22 — Segurança e monitoramento do EndoBot

### Adicionado

- O EndoBot agora identifica sinais fortes de tentativa de contornar instruções, revelar configurações internas, assumir outro papel ou executar comandos.
- Eventos suspeitos armazenam somente códigos de detecção, uma impressão protegida da rede e uma impressão do texto; o conteúdo da conversa e o IP em claro não são registrados.
- A repetição desses sinais em uma janela curta bloqueia temporariamente o EndoBot na rede. Para contas autenticadas, a repetição também aplica uma suspensão temporária auditável.
- O painel `/admin` ganhou a área **Segurança do EndoBot**, exclusiva do Dono. Ela permite revisar eventos e liberar o bloqueio da rede quando necessário; a restauração da conta permanece nos controles de usuários já protegidos.

### Validado

- TypeScript e build do frontend foram aprovados. A suíte Vitest do frontend passou com **57 testes em 24 arquivos**; o backend passou com **25 testes em 10 arquivos** e verificação TypeScript.

---

## 2026-08-22 — Rótulo compacto de acesso

### Alterado

- O botão de acesso dos cabeçalhos passou de **“Entrar com e-mail”** para **“Logar”** em português. A mesma redução foi aplicada aos demais idiomas: **“Log in”** em inglês e **“Iniciar sesión”** em espanhol.
- O fluxo de autenticação e a hierarquia visual do botão permanecem inalterados; a alteração reduz apenas o comprimento da cópia do controle.

### Validado

- TypeScript, build de produção e a suíte Vitest foram aprovados com **57 testes em 24 arquivos**.

---

## 2026-08-22 — Correção do painel VLibras

### Corrigido

- O atalho de acessibilidade em Libras agora detecta quando o serviço externo abre um painel sem conteúdo e o fecha automaticamente, evitando que uma superfície branca vazia cubra o site.
- Quando o conteúdo do tradutor não fica pronto, o site exibe uma mensagem curta e acessível para orientar a pessoa a tentar novamente, em vez de simular uma tradução ou deixar o painel quebrado aberto.

### Validado

- O fechamento seguro do estado vazio recebeu teste. TypeScript, build de produção, a suíte Vitest com **56 testes em 23 arquivos** e a verificação mecânica da interface foram aprovados.

---

## 2026-08-22 — Diário em rota própria

### Alterado

- O diário de sintomas saiu da homepage e passou a abrir na rota dedicada **`/diario`**. Os atalhos "Diário" e "Começar meu diário" agora levam diretamente a essa página.
- O componente do diário foi preservado: formulário, campos de medicação, registros antigos, gráfico de dor, estilos, textos, avisos e comportamento local permanecem os mesmos.
- A comparação temporária de redesign e sua rota de protótipos foram removidas sem alterar o visual final do diário.

### Validado

- A navegação da homepage para `/diario` foi verificada localmente. TypeScript, build de produção e a suíte Vitest foram aprovados com **55 testes em 23 arquivos**.

---

## 2026-08-22 — Edição de artigos pelo painel administrativo

### Adicionado

- A lista de artigos recentes no painel `/admin` agora oferece o botão **Editar** para cada artigo existente.
- Ao selecionar um artigo, o formulário administrativo é preenchido com a categoria, o título, o resumo e o conteúdo salvos. O painel permite atualizar o rascunho, atualizar o artigo publicado ou cancelar a edição sem alterar o conteúdo persistido.

### Segurança e operação

- A edição é exibida apenas para os cargos que já possuem a permissão de gerenciamento de blog. A atualização usa a política protegida existente para `blog_posts` e preserva a data original de publicação quando um artigo já publicado é atualizado.

### Validado

- TypeScript, build de produção e a suíte Vitest foram aprovados com **54 testes em 22 arquivos**.

---

## 2026-08-22 — Cargos administrativos, usuários e log de punições

### Adicionado

- A administração agora diferencia os cargos **Dono**, **Admin**, **Moderador** e **Suporte**, com controles de interface alinhados às permissões de cada função.
- O Dono pode atribuir ou remover os cargos Suporte, Moderador e Admin por meio de um diálogo explícito no painel. Contas de Dono permanecem protegidas.
- A área de contas foi reorganizada como **Usuários**: cada pessoa exibe status, cargo, data de criação, medida ativa, prazo e reputação de punições (**Boa**, **Atenção** ou **Muito ruim**).
- Foi incluída a seção **Log de punições**, que apresenta a pessoa responsável, a pessoa afetada, a transição de status, o motivo, o prazo e a data da alteração.

### Segurança e operação

- As áreas de Usuários, Log de punições, Suporte, Relatos e Blog aparecem somente quando o cargo atual possui a permissão correspondente.
- Os controles sensíveis seguem a matriz de cargos: apenas o Dono redefine senhas diretamente ou gerencia cargos; Dono e Admin podem excluir contas e enviar e-mails de redefinição; Moderador opera suporte, relatos e punições; Suporte atende conversas e consulta logs.

### Validado

- TypeScript, build de produção e a suíte Vitest do frontend foram aprovados com **53 testes em 22 arquivos**. O backend também aprovou **22 testes em 9 arquivos** para as proteções dos endpoints por cargo.

---

## 2026-08-22 — Diário com horário e medicação registrada

### Corrigido

- O gráfico e a lista de registros agora usam **data e horário de criação** para ordenar entradas feitas no mesmo dia. Os eixos e tooltips exibem a data e a hora de cada ponto.

### Adicionado

- O campo de medicação passou a oferecer categorias para registro de uso já orientado: analgésico, anti-inflamatório, contraceptivo hormonal combinado, progestagênio e modulador de GnRH.
- A opção **Outros** abre um campo de texto para registrar, sem padronizar, o nome que consta na receita ou orientação. O diário reforça que se trata somente de registro e não de recomendação de tratamento.

### Validado

- A ordenação por horário recebeu cobertura de teste. A suíte Vitest com **51 testes em 22 arquivos**, TypeScript e o build de produção foram aprovados.

---

## 2026-08-22 — Atualizações em tempo real, suporte e EndoBot

### Adicionado

- Controles de conta, notificações, relatos e filas administrativas agora usam atualizações em tempo real. Mudanças feitas por administradoras aparecem sem recarregar a página, inclusive em contas abertas em outro dispositivo.
- Restrições e suspensões novas exigem uma data e horário futuros. A pessoa afetada vê quando a medida termina; a interface também atualiza quando o prazo chega ao fim.
- Contas restritas ou suspensas podem abrir um canal privado de suporte para questionar a medida. Administradoras veem e respondem às conversas no painel, também em tempo real.
- O EndoBot ganhou perguntas iniciais contextualizadas, exclusão de conversas privadas salvas e envio com **Enter**. **Shift + Enter** mantém a quebra de linha no campo de mensagem.

### Segurança

- Conversas de suporte são isoladas por políticas do banco: apenas a pessoa solicitante e administradoras podem ler ou enviar mensagens. A criação de atendimento é permitida somente enquanto a conta estiver restrita ou suspensa.
- As assinaturas em tempo real respeitam as políticas de leitura existentes e não dão ao navegador acesso direto à lista interna de contas.

### Validado

- As migrações de suporte e de prazo obrigatório foram aplicadas. TypeScript, build de produção e a suíte Vitest foram aprovados com **51 testes em 22 arquivos**.

---

## 2026-08-21 — Gráfico do diário em ordem cronológica

### Corrigido

- O gráfico de dor agora organiza os registros da esquerda para a direita, do mais antigo ao mais recente. Em registros feitos na mesma data, a sequência respeita o momento em que cada registro foi criado.

### Refinado

- A visualização passou a apresentar uma direção temporal explícita, pontos individuais, eixos reduzidos a 0, 5 e 10, datas localizadas e um tooltip mais legível. A curva linear preserva fielmente cada registro, sem sugerir valores intermediários.

### Validado

- A regra de ordenação recebeu teste específico; TypeScript, build de produção e a verificação visual mecânica do componente foram aprovados.

---

## 2026-08-21 — Notificações de relatos e cargo de Dono

### Corrigido

- Ao excluir um relato, a administração agora considera o status anterior: relatos **rejeitados** não recebem um segundo aviso que poderia sugerir publicação prévia. Relatos publicados e relatos ainda pendentes recebem mensagens distintas e contextualizadas quando removidos.
- O título do papel proprietário no painel foi atualizado de **Dona** para **Dono** em português e de **Dueña** para **Dueño** em espanhol.

### Validado

- A migração do Supabase foi aplicada. TypeScript, build de produção e os testes de salvaguardas da administração foram aprovados.

---

## 2026-08-21 — Atalho administrativo e copyright em todas as rotas

### Adicionado

- Pessoas administradoras autenticadas passam a ver um botão **Administração** nas navegações da página inicial e do blog. O botão só é exibido após a confirmação protegida do papel no Supabase e abre a rota `/admin`.
- O copyright **© 2026 EndoCare** foi centralizado em um componente reutilizável e agora aparece na homepage, no blog, na área administrativa e na página de rota inexistente.

### Corrigido

- O rodapé do blog passou a usar a grafia pública EndoCare e o crédito coletivo para alunos do SESI, seguindo o restante do site.

### Validado

- A checagem TypeScript, o build de produção e os testes das páginas Home, Blog e Admin foram aprovados.

---

## 2026-08-21 — Papel de Dona e delegação administrativa protegida

### Adicionado

- A conta `enzoyurikuroiva@gmail.com` foi designada como a única **Dona** da plataforma, permanecendo também como administradora.
- A Dona agora visualiza no painel `/admin` um controle exclusivo para conceder ou remover o papel de administradora de outras contas, sempre com confirmação explícita.

### Segurança

- A alteração de papéis é executada por uma função protegida no Supabase: administradoras comuns não conseguem elevar privilégios, remover a Dona ou alterar o papel da própria conta.
- O banco mantém uma única Dona, registra concessões e revogações de administração em auditoria privada e preserva as demais proteções de contas administrativas.

### Validado

- TypeScript, build de produção e suíte Vitest foram aprovados com **47 testes em 21 arquivos**.

---

## 2026-08-21 — Bloqueio de login mais curto

### Corrigido

- Após cinco tentativas consecutivas de login, a proteção local passa a aguardar somente **30 segundos** antes de liberar uma nova tentativa, em vez de 300 segundos. Os demais limites de ações sensíveis, como cadastro, alteração de senha e recuperação, permanecem inalterados.

### Validado

- O teste do limitador verifica o bloqueio e a liberação após trinta segundos. A checagem TypeScript também foi aprovada.

---

## 2026-08-21 — Controles de conta, avisos e continuidade de uso

### Adicionado

- A aplicação passou a consultar o estado privado da conta e suas notificações. Contas **suspensas** recebem uma tela de bloqueio de acesso; contas **restritas** permanecem informadas, mas não podem conversar com o EndoBot nem enviar relatos.
- O painel `/admin` agora permite estabelecer data e hora de expiração para restrições e suspensões, exibe a expiração na conta, modera relatos com aviso ao autor e apresenta uma exclusão definitiva de conta protegida por palavra-chave de confirmação.
- Relatos agora mostram um contador circular de publicações à esquerda do título e têm limite explícito de **1.600 caracteres**, com contador de digitação e validação correspondente no banco.
- O diário mostra todos os registros locais e permite reabrir, editar, salvar novamente ou excluir cada registro, inclusive os mais antigos.

### Corrigido

- O indicador do EndoBot deixa de ser estático: consulta periodicamente a disponibilidade real do backend e do provedor de IA, ficando verde quando disponível, âmbar durante a verificação e vermelho quando estiver indisponível ou em manutenção.
- A barra superior do vídeo mostra somente sua duração; a informação de áudio em português brasileiro permanece na área explicativa ao lado e na nota de acessibilidade.
- A marca visível no cabeçalho e rodapé foi padronizada como **EndoCare**, e o crédito institucional passou a reconhecer **alunos do SESI**.

### Segurança

- A experiência de contas restritas e suspensas é complementada por regras persistidas no Supabase, notificações privadas para ações administrativas e um endpoint de backend que impede exclusão da própria conta ou de contas administrativas.

### Validado

- Checagem TypeScript, build de produção e **44 testes em 21 arquivos** do frontend foram aprovados. A suíte do backend aprovou **20 testes em 8 arquivos**.

---

## 2026-08-21 — Retorno à leitura editorial do blog

### Alterado

- A página `/blog` voltou ao layout de leitura contínua anterior: introdução editorial, lista linear de artigos e texto integral exposto, sem cards Revista, filtros ou painéis expansíveis.
- Cada artigo agora mostra um ícone de relógio, a data completa com horário de publicação e o tempo relativo, como **“há 1 hora”**, localizado em português, inglês e espanhol.

### Validado

- A página foi conferida visualmente com artigo real carregado do Supabase. TypeScript, build de produção e suíte Vitest foram aprovados com **41 testes em 20 arquivos**.

---

## 2026-08-21 — Rolagem automática do EndoBot

### Corrigido

- O histórico do EndoBot agora acompanha automaticamente a mensagem mais recente quando a pessoa está no fim da conversa, inclusive após o retorno da resposta do assistente.
- Quando a pessoa rola para ler mensagens anteriores, o chat deixa de forçar sua posição e apresenta o controle **“Ir para a mensagem mais recente”**. A preferência de redução de movimento mantém o salto imediato, sem animação adicional.

### Validado

- A lógica de proximidade do fim do histórico recebeu teste unitário. TypeScript, build de produção e a suíte Vitest foram aprovados com **41 testes em 20 arquivos**.

---

## 2026-08-21 — Recuperação e segurança de senha

### Adicionado

- O modal de acesso agora oferece **“Esqueci minha senha”**, com solicitação limitada de um link privado de recuperação. O retorno do link continua abrindo as configurações privadas da própria pessoa para que ela escolha a nova senha.
- Cadastro, configurações pessoais e redefinição administrativa direta agora mostram um indicador localizado de força de senha: **Fraca**, **Boa** ou **Segura**, acompanhado dos requisitos visíveis.
- Para suporte excepcional, o painel `/admin` passou a oferecer **“Definir nova senha”** somente para contas comuns que a administradora já pode gerenciar. A senha anterior continua inacessível e a operação é registrada em uma trilha privada de auditoria.

### Segurança

- A regra de senha exige pelo menos dez caracteres, letra maiúscula, número, caractere especial e ausência de uma mesma sequência repetida três vezes. A validação ocorre tanto no navegador quanto no endpoint administrativo do servidor.
- A redefinição administrativa exige sessão válida, origem exclusiva do site principal, papel administrativo no banco, bloqueio de alteração da própria conta ou de outras administradoras, limitação local de tentativas e chave de serviço mantida somente no backend.

### Validado

- A recuperação e o cadastro foram conferidos visualmente na prévia local. TypeScript, build de produção e suíte Vitest foram aprovados; os testes de política de senha cobrem requisitos ausentes, repetição excessiva e as classificações Boa e Segura.

---

## 2026-08-21 — Redesign Revista do blog público

### Alterado

- A rota pública `/blog` recebeu a direção editorial **Revista**, escolhida após uma exploração visual isolada. A página agora combina uma abertura tipográfica ampla, selo editorial, cartões assimétricos por categoria e uma composição responsiva que se reorganiza em uma coluna em telas menores.
- Os artigos continuam vindo exclusivamente de `blog_posts` publicados. Cada cartão preserva categoria, data, resumo e conteúdo integral em um controle nativo de expansão, sem alterar a publicação e exclusão administrativas existentes.
- Um filtro editorial por categorias presentes no banco permite percorrer as leituras publicadas e atualiza a contagem de resultados sem nova requisição.

### Movimento e acessibilidade

- A entrada dos cartões usa `transform` e opacidade, com escalonamento curto de 48 ms e a curva global `--ease-out`. A elevação por hover só aparece em dispositivos com ponteiro preciso; controles têm confirmação por pressão de 160 ms.
- A página inclui comportamento específico para `prefers-reduced-motion`: elimina deslocamentos dos cartões e do spinner, preservando estados de foco, cor, borda e expansão do conteúdo.

### Validado

- A direção foi verificada em prévia local com artigos reais, incluindo carregamento, filtro de categoria e leitura expandida do conteúdo. A rota experimental de protótipos foi removida após a escolha.

---

## Estado atual

| Área | Situação atual |
|---|---|
| Idioma | Interface global em português, inglês e espanhol. |
| Acesso | Cadastro e login por e-mail, confirmação por código e acesso sem exibir o e-mail na navegação. |
| Conta | Nome exibido, troca de senha e saída de conta em configurações privadas. |
| EndoBot | Conversa geral sem login, temporária após recarregar; histórico privado por categoria para contas autenticadas. |
| Conteúdo | Diário de sintomas, fitoterapia contextualizada, blog público em rota própria e relatos moderados. |
| Segurança | Limites locais de tentativa, validações de entrada, avisos de privacidade e interface sem identificação de serviços internos. |

---

## 2026-08-21 — Nova identidade pública

### Alterado

- A marca pública permanece como **EndoCare**, conforme solicitado. O título da página, a assinatura do player, o cabeçalho, o rodapé, o copyright e os roteiros voltam a usar essa identidade.

---

## 2026-08-21 — Atalho de acessibilidade em Libras

### Adicionado

- O widget de acessibilidade em Libras foi integrado de forma global com a biblioteca `@djpfs/react-vlibras`, conforme solicitado. O atalho flutuante e o painel de tradução são fornecidos pelo próprio VLibras.
- A política de segurança passou a permitir somente a origem necessária do VLibras para script, conexão e conteúdo incorporado.

### Acessibilidade

- O carregamento acontece uma única vez na raiz do aplicativo, usando o modo assíncrono compatível com a biblioteca. O atalho respeita a preferência de redução de movimento nos ajustes visuais locais.
- A política de segurança também permite a CDN oficial usada pelo carregador do VLibras após o redirecionamento, além das APIs oficiais de tradução e dicionário estritamente necessárias ao widget.

---

## 2026-08-21 — Acabamento do seletor global de idioma

### Corrigido

- O seletor do cabeçalho passou a remover a moldura nativa interna que aparecia em alguns navegadores desktop. Agora há somente uma superfície visual, com ícone, idioma e seta própria, sem alterar o comportamento, a tradução ou o foco por teclado.

---

## 2026-08-21 — Correção do diretório de contas e recuperação administrativa de senha

### Corrigido

- A migração de gerenciamento de contas foi aplicada ao ambiente Supabase de produção, criando o diretório privado e a função protegida usados pela seção **Gerenciar contas** do painel `/admin`.
- As contas já existentes foram sincronizadas para o diretório administrativo, restaurando a listagem para administradoras autorizadas.

### Adicionado

- Cada conta comum agora possui a ação **“Enviar link de redefinição”**, com confirmação explícita e limite local de três solicitações em quinze minutos.
- O e-mail de recuperação direciona a pessoa para as configurações privadas do próprio EndoCare, onde ela escolhe a nova senha. A administração não visualiza, define nem armazena senhas.

### Segurança

- A função interna que sincroniza cadastros no diretório administrativo deixou de ser executável pela API RPC; ela permanece disponível somente ao trigger do banco.

---

## 2026-08-21 — Exclusão protegida de conteúdo administrativo

### Adicionado

- O painel `/admin` agora permite excluir relatos e artigos do blog após confirmação explícita.
- A exclusão usa uma função administrativa protegida no Supabase e registra o tipo de conteúdo, alvo, administradora responsável e data em trilha interna de auditoria.
- A moderação passou a exibir os relatos recentes para que conteúdos já aprovados ou rejeitados também possam ser removidos quando necessário.

---

## 2026-08-21 — Redesign operacional da administração

### Alterado

- A rota `/admin` passou a usar uma mesa operacional com barra de contexto, navegação lateral por tarefa e áreas de trabalho sequenciais para contas, relatos e artigos.
- Controles de estado, filtros, ações sensíveis e trilha de auditoria receberam hierarquia visual mais clara, preservando todas as permissões e fluxos administrativos existentes.
- A composição foi adaptada para telas menores com navegação horizontal e ações de largura adequada ao toque.

---

## 2026-08-21 — Marca própria do EndoCare

### Alterado

- A folha genérica foi substituída por uma marca autoral composta por dois traços de acolhimento e um ponto pêssego, com desenho otimizado para leitura em tamanhos pequenos.
- O novo símbolo foi aplicado ao cabeçalho, rodapé e favicon do site principal, incluindo o ícone exibido na aba do navegador.

---

## 2026-08-21 — Revelações de rolagem reversíveis

### Alterado

- As seções públicas deixam de manter a entrada como um estado permanente: ao sair do campo de visão, reduzem gradualmente opacidade, deslocamento e desfoque; ao retornar, recuperam a revelação.
- O observador de rolagem permanece ativo para acompanhar idas e voltas, em vez de deixar de observar a seção após a primeira entrada.

### Acessibilidade

- Pessoas que preferem redução de movimento continuam vendo o conteúdo sem deslocamentos ou desfoque adicionais.

---

## 2026-08-21 — Remoção do progresso de rolagem

### Removido

- A faixa fixa que preenchia o topo durante a rolagem foi removida da homepage e das demais superfícies públicas.
- O cálculo de progresso associado foi retirado, preservando somente o parallax discreto do painel visual e as revelações de seção.

---

## 2026-08-21 — Continuidade Aurora na homepage desktop

### Corrigido

- A passagem entre o hero e a primeira seção deixou de depender de uma faixa clara isolada e de margens concorrentes, que produziam um corte abrupto e um recorte aparente em navegadores desktop.
- A primeira seção agora sobrepõe o fim do hero de forma controlada, criando um único plano de leitura com borda superior editorial e sem alterar o conteúdo, as rotas ou os comportamentos da página.

### Alterado

- O hero utiliza uma luz pêssego difusa na parte inferior para dissolver gradualmente a base ameixa no fundo marfim da seção de fitoterapia.
- A tipografia do hero e da primeira seção recebeu medida mais equilibrada no desktop, enquanto a revelação repetitiva da primeira seção foi removida para não competir com a nova passagem visual.

### Movimento e acessibilidade

- A passagem Aurora é o único momento autoral da dobra inicial: uma revelação curta de opacidade e `transform`, com curva compartilhada e desativação de deslocamento para pessoas que preferem redução de movimento.

---

## 2026-08-21 — Revisão visual sóbria para celular

### Alterado

- As seções deixaram de alternar entre blocos escuros e claros de forma brusca; diário, EndoBot, vídeo e relatos agora usam tons claros relacionados entre si e profundidade discreta.
- O hero preserva a identidade ameixa, mas perdeu a marca d’água decorativa, reduziu a rotação e suavizou sombras e escala tipográfica.
- A barra superior móvel voltou a ser uma superfície flutuante arredondada, com respiro lateral, marca, idioma e menu integralmente visíveis.

### Mobile

- A área superior do hero ganhou espaço para não esconder o título sob a navegação fixa.
- O EndoBot foi convertido de uma faixa escura para uma superfície clara de leitura, reduzindo a ruptura visual após o diário.

---

## 2026-08-21 — Correções de celular e revelação por gradiente

### Corrigido

- A seção de relatos passou a aceitar conteúdo longo sem quebra de palavra, preservando a largura do cartão, dos filtros e do formulário em telas móveis.
- Cabeçalho, seletor de idioma, seções ancoradas, chat e formulários receberam limites de largura e espaçamentos específicos para telas de até 560 px.

### Movimento

- O observador de rolagem agora revela seções logo no início da entrada no campo de visão, em vez de esperar uma parcela grande do conteúdo.
- As seções recebem uma varredura breve de gradiente pêssego e uma entrada com desfoque discreto, com versões mais curtas no celular. Pessoas que preferem redução de movimento não recebem deslocamento nem a varredura visual.

---

## 2026-08-21 — Reformulação editorial de alto contraste

### Alterado

- A homepage passou a apresentar uma composição visual claramente distinta: hero ameixa em largura total, tipografia clara em escala ampliada, painel de contexto em papel rotacionado e marca d’água editorial da própria marca.
- Fitoterapia, diário, EndoBot, vídeo e relatos agora possuem ritmos próprios de cor, superfícies e contrastes, tornando a progressão da página perceptível ao rolar.
- Cartões botânicos receberam variações cromáticas por planta; o diário ganhou uma faixa lavanda; o EndoBot passou a ocupar uma área escura de foco; e as áreas de vídeo e relatos assumiram superfícies contrastantes.

### Movimento e responsividade

- Foi adicionado um único momento de entrada autoral para o painel do herói, com revelação de papel, sombra e rotação controlada; a preferência de redução de movimento o desativa.
- A composição móvel mantém título, explicação e chamadas antes do painel, com contraste alto e áreas de toque amplas.

---

## 2026-08-21 — Refinamento de materiais e movimento

### Alterado

- A homepage recebeu uma camada visual mais coesa: superfícies com profundidade, cabeçalho translúcido apenas onde há sobreposição de conteúdo, controles em formato mais tátil, foco visível e melhor acabamento em seleção, cursor e barras de rolagem.
- A hierarquia tipográfica passou a usar espaçamento e quebra de linha mais controlados; o rótulo decorativo acima do título principal foi removido para concentrar a atenção na mensagem central.
- Painéis do herói, diário, EndoBot, vídeo, histórias e formulários passaram a compartilhar materiais, bordas e sombras compatíveis com a paleta acolhedora do produto.

### Movimento e acessibilidade

- O parallax do herói agora atualiza somente o elemento visual que o utiliza, reduzindo o custo de recálculo de estilos durante a rolagem.
- A troca da planta ativa tornou-se interruptível por transições, substituindo o pulso em keyframes que reiniciava durante alternâncias rápidas.
- Pessoas que preferem redução de movimento deixam de receber deslocamentos, mas mantêm feedback breve de cor, borda, opacidade e foco.
- Foram documentados planos de auditoria e implementação de movimento em `frontend/plans/`, preservando valores de duração, curvas e verificações de acessibilidade.

---

## 2026-08-20 — Remoção do assistente de Libras

### Removido

- A caixa flutuante “Libras”, o atalho “Apoio em Libras” na seção de vídeo e a integração externa do tradutor foram removidos conforme solicitado.
- Os estilos, testes, cópias localizadas e a documentação exclusiva do recurso também foram retirados.
- A CSP deixou de autorizar as origens que eram exclusivas do widget, preservando apenas as permissões necessárias ao site, ao vídeo e ao modelo 3D.

### Preservado

- O vídeo educativo, sua narração, o guia textual dos tópicos, as fontes clínicas e o aviso de conteúdo informativo permanecem disponíveis na seção “Saiba mais”.

---

## 2026-08-20 — Assistente flutuante de Libras

### Adicionado

- Caixa flutuante **“Libras”**, acessível por teclado e localizada em português, inglês e espanhol, com abertura e fechamento explícitos.
- Ação contextual **“Apoio em Libras”** na seção “Saiba mais”, que abre o assistente e leva ao guia textual do vídeo educativo.
- Integração progressiva com o widget oficial do VLibras, incluindo estado de preparo, confirmação de disponibilidade e orientação quando a origem externa estiver indisponível.

### Acessibilidade e segurança

- A explicação do assistente deixa claro que a tradução automática é um apoio e não substitui intérprete humano para conteúdo audiovisual.
- A política CSP foi atualizada para permitir o domínio oficial do VLibras somente nas diretivas necessárias ao widget: `script-src`, `frame-src` e `connect-src`.
- A implementação respeita redução de movimento, preserva foco visível e mantém o guia textual do vídeo como alternativa caso o widget não possa ser carregado.

### Validado

- Foram adicionados testes para cópias localizadas do assistente e para a presença da ação de Libras no vídeo.

---

## 2026-08-20 — Correção de entrega do vídeo no domínio público

### Corrigido

- O player da seção “Saiba mais” deixou de usar a rota relativa `/manus-storage/...`, que o Vercel resolvia para o próprio domínio sem entregar o MP4.
- O vídeo rotulado agora referencia uma URL pública direta de mídia com resposta `200` e `Content-Type: video/mp4`.
- A política de segurança passou a declarar `media-src 'self' https://files.manuscdn.com`; antes disso, `default-src 'self'` ainda bloqueava a reprodução apesar de o elemento conter a URL correta.

### Validado

- A inspeção pública confirmou o MP4 externo no elemento `source`; os cabeçalhos do ativo confirmam `Accept-Ranges: bytes` e os codecs H.264/AAC são aceitos pelo navegador. A causa final foi documentada em `docs/VALIDACAO_VIDEO_ENDOMETRIOSE.md`.
- A configuração JSON do Vercel, TypeScript, **31 testes em 15 arquivos** e build de produção foram aprovados antes da publicação da CSP revisada.
- No domínio público após a propagação do deploy, o player apresentou `currentSrc` no CDN, duração de aproximadamente 122 segundos, `readyState: 4`, `networkState: 1` e nenhum erro de mídia.

---

## 2026-08-20 — Movimento mais perceptível no celular

### Refinado

- A revelação por rolagem em telas de até 760 px agora começa quando uma parte maior da seção está efetivamente visível, evitando que a animação termine antes de aparecer no campo de visão.
- Entradas de seção, cartões e conteúdo do vídeo receberam deslocamentos iniciais um pouco maiores e durações explicativas específicas para celular.
- A barra de progresso ganhou maior espessura e sombra discreta no celular; os principais controles e cartões também possuem uma confirmação tátil mais nítida ao toque.

### Acessibilidade e validação

- A preferência por redução de movimento desativa inclusive as novas entradas internas de cartões e do vídeo.
- Foram adicionados testes para o gatilho de rolagem móvel. TypeScript, **31 testes em 15 arquivos**, build de produção e verificação de interface foram aprovados.

---

## 2026-08-20 — Gerenciamento administrativo de contas

### Adicionado

- Nova seção **Gerenciar contas** em `/admin`, com busca por nome ou e-mail, filtros por estado e visualização limitada à administração autorizada.
- Medidas reversíveis de **restrição**, **suspensão** e **restauração**, acompanhadas de confirmação explícita, motivo interno obrigatório e estado visual claro.
- Migração versionada para diretório privado de contas, controles de estado, trilha de auditoria e procedimentos remotos administrativos.

### Segurança

- A interface não faz leitura ou atualização direta das tabelas de contas: utiliza apenas RPCs que verificam `is_endoacolhe_admin()` no banco.
- Contas administrativas e a própria conta da pessoa administradora não podem ser alteradas por esse painel.
- A migração bloqueia novos relatos e persistência autenticada do EndoBot para contas não ativas. O backend do EndoBot também consulta o estado de conta e falha de forma fechada para sessões autenticadas restritas ou suspensas.

### Validado

- Testes de regras de ação, salvaguardas da migração e autenticação do backend foram adicionados.
- Frontend: **29 testes em 14 arquivos**, tipagem e build aprovados. Backend: **13 testes em 5 arquivos**, com tipagem aprovada.

---

## 2026-08-20 — Vídeo acessível e sistema de movimento refinado

### Adicionado

- A navegação principal agora inclui um atalho localizado para a seção **“Saiba mais”**, tornando o vídeo educativo encontrável sem exigir rolagem manual.
- A troca entre homepage, blog e relatos passou a usar uma breve transição de saída; pessoas que preferem redução de movimento navegam imediatamente.

### Refinado

- A revelação por rolagem agora abrange as seções públicas e os artigos do blog, com entrada única, escalonamento discreto e movimentos distintos para o vídeo e seu texto explicativo.
- Estados de botões, cartões e seletor de idioma receberam transições mais consistentes; elevação por hover ocorre apenas em dispositivos com cursor preciso.

### Validado

- A integração referencia o MP4 estático rotulado e foi coberta por teste de URL; o sistema de transição possui testes próprios para duração e redução de movimento.
- TypeScript, build de produção, detector de interface e **23 testes em 12 arquivos** foram aprovados.

---

## 2026-08-20 — Separação dos controles do cabeçalho

### Corrigido

- O seletor de idioma e o botão de conta agora pertencem a um agrupamento utilitário próprio, com espaçamento horizontal explícito de **10 px**.
- Em larguras intermediárias, o grupo preserva a posição ao lado do menu, enquanto em telas menores o botão de conta continua seguindo a regra responsiva já existente.

### Validado

- Medição renderizada na prévia local confirmou 10 px entre o fim do seletor de idioma e o início do botão de conta.
- Tipagem, suíte Vitest e build de produção foram concluídos; o detector de layout não encontrou problemas mecânicos.

---

## 2026-08-20 — Anatomia didática no vídeo educativo

### Alterado

- A cena anatômica do vídeo passou a incluir setas e rótulos para **útero**, **tuba uterina**, **ovário** e **focos ilustrativos fora do útero**.
- A descrição da seção “Saiba mais” foi atualizada nos três idiomas para informar que a cena é didática e que os focos exibidos são apenas ilustrativos.
- O player passou a referenciar o novo arquivo de vídeo rotulado no armazenamento estático do projeto.

### Validado

- Um quadro da cena revisada foi conferido visualmente para garantir legibilidade e coerência entre cada seta e a estrutura identificada.
- A documentação do roteiro e da validação do vídeo passou a explicitar que a ilustração não representa diagnóstico, extensão, gravidade ou localização individual.

---

## 2026-08-19 — Vídeo educativo e seção Saiba mais

### Adicionado

- Vídeo educativo de aproximadamente dois minutos, com narração feminina acolhedora em português brasileiro, sobre endometriose, preparação para conversas de cuidado e os limites responsáveis da fitoterapia.
- Nova seção pública **“Saiba mais”** na homepage, com player nativo, resumo localizado em português, inglês e espanhol, aviso informativo, fontes clínicas expansíveis e indicação de idioma da narração.
- Documentação do roteiro, plano audiovisual, bases clínicas e validação do ativo em `frontend/docs/`.

### Segurança e conteúdo

- O vídeo não oferece diagnóstico individual, prescrição, produto, dose, promessa de resultado ou indicação de fitoterápicos para endometriose.
- A abordagem de fitoterapia reforça o uso racional e a necessidade de conversa com profissional, com referências à OMS, Ministério da Saúde e ESHRE.

### Validado

- O MP4 final foi gerado em 1280×720, com H.264, áudio AAC e duração aproximada de 122 segundos; o ativo está acessível pelo armazenamento estático do projeto.
- Checagem de tipos e build de produção concluídos; a suíte Vitest foi aprovada com 21 testes em 11 arquivos.
- A composição da seção foi verificada no navegador em espanhol, e a cópia alternativa do player foi localizada para os três idiomas.

---

## 2026-08-19 — Blog público e publicação administrativa

### Adicionado

- Página pública de leitura em `/blog`, com carregamento de artigos publicados diretamente da tabela `blog_posts`.
- Estado de carregamento, mensagem de indisponibilidade e estado vazio para a página de artigos, nos idiomas português, inglês e espanhol.
- Formulário no painel administrativo protegido para criar novos artigos como **rascunho** ou como conteúdo **publicado**.
- Lista administrativa dos artigos recentes, com status e data de atualização.

### Alterado

- A homepage passou a manter exclusivamente a seção de relatos da comunidade; a navegação “Blog” agora leva à rota própria de artigos.
- A leitura pública restringe-se a conteúdos publicados, enquanto o formulário de criação permanece condicionado à verificação administrativa e às políticas RLS já aplicadas ao banco.

### Validado

- A tabela `blog_posts` e as políticas de leitura pública e escrita administrativa foram conferidas no banco ativo.
- Checagem de tipos, build de produção, detector de interface e suíte Vitest foram concluídos, com 20 testes aprovados em 11 arquivos.

---

## 2026-08-19 — Composição de foto e modelo botânico

### Corrigido

- A fotografia botânica deixou de depender de caminhos internos do ambiente anterior e passou a usar imagens externas estáveis de referência.
- A foto e o modelo interativo foram reorganizados em painéis lado a lado, evitando que a foto se sobreponha ao modelo ou fique fora da área visível.
- Os controles, informações e elementos auxiliares do incorporado 3D foram desativados por parâmetros do visualizador.
- O crédito do modelo foi deslocado para fora da moldura interativa, eliminando a faixa sobreposta ao conteúdo.

### Validado

- A foto externa foi exibida ao lado do painel 3D no ambiente local, inclusive no pôster de carregamento.
- O ambiente de sandbox apresentou um erro de conexão do próprio incorporado remoto após o clique. A origem do modelo e o link de crédito continuam disponíveis, e a validação em uma origem de produção deve ser feita antes de considerar o carregamento remoto confirmado.

---

## 2026-08-19 — Acesso por e-mail, segurança e configurações de conta

**Commits:** `37925ae`, `f20f051`

### Adicionado

- Painel **Configurações da conta**, aberto ao clicar no nome da pessoa autenticada no cabeçalho.
- Atualização do nome exibido, sem expor o e-mail na navegação.
- Atualização de senha com confirmação, mínimo de dez caracteres e feedback de sucesso ou erro.
- Ação de sair da conta dentro do painel privado.
- Documentação de validação local do EndoBot em `docs/VALIDACAO_LOCAL_ENDOBOT.md`.
- Teste de regressão que garante que uma conversa temporária do EndoBot começa limpa e recebe a saudação no idioma selecionado.

### Alterado

- O acesso passou a ser **exclusivamente por e-mail**. A opção de entrada com Google, seus rótulos, ícone, fluxo e testes foram removidos.
- O limitador de tentativas passou a persistir no navegador para reduzir a possibilidade de reiniciar a página e repetir solicitações imediatamente.
- Os limites foram aplicados a login, cadastro, confirmação de código, reenvio de código, atualização de perfil e troca de senha.
- As mensagens de verificação de acesso foram tornadas neutras, sem expor o nome de serviços internos na interface.
- O nome informado no cadastro e nas configurações é normalizado antes de ser gravado.

### Validado

- EndoBot sem login respondeu a perguntas gerais em português, inglês e espanhol quando chamado pela origem autorizada.
- A conversa anônima foi descartada após recarregar a página local.
- O teste local da interface mantém a origem bloqueada pelo backend quando ela não é autorizada, preservando a política de origem restrita.
- Checagem de tipos, build de produção e suíte Vitest foram concluídos com sucesso.

---

## 2026-08-19 — Internacionalização completa e área administrativa

**Commits:** `7cfd666`, `5b5e055`

### Adicionado

- Contexto global de idioma com persistência local para **português, inglês e espanhol**.
- Tradução da homepage, diário de sintomas, fitoterapia, modelos botânicos, blog, relatos, EndoBot e modal de autenticação.
- Tradução das mensagens auxiliares, filtros de relatos, categorias de conversa e rótulos de acessibilidade.
- Área administrativa em rota própria, com estados de acesso restrito e interface de moderação de relatos.
- Utilitários e testes para rótulos administrativos, idioma do EndoBot e cópias da interface.

### Alterado

- O seletor de idioma do site e o seletor do EndoBot permanecem sincronizados.
- A resposta inicial do EndoBot e a experiência de conversa temporária acompanham o idioma escolhido.
- O modal de acesso passou a apresentar todos os textos de cadastro, login, confirmação e reenvio nos três idiomas.
- A seção botânica passou a localizar descrições, alertas, contexto de evidência, textos alternativos e créditos fotográficos.
- As animações de entrada e rolagem foram ajustadas para maior consistência, com respeito à preferência de redução de movimento.

---

## 2026-08-19 — Evolução do acesso e proteção de tentativas

**Commit:** `add86cb`

### Adicionado

- Modal de autenticação por e-mail com cadastro, login, confirmação por código e reenvio de código.
- Exibição do nome escolhido pela pessoa autenticada no cabeçalho, em vez de mostrar o e-mail.
- Limites locais de tentativas de autenticação e mensagens de espera.
- Utilitário para definir o nome de perfil com prioridade para o nome escolhido no cadastro.
- Cobertura automatizada para o perfil e para o limitador de tentativas.

### Histórico de compatibilidade

- Esta etapa incluiu temporariamente uma alternativa de entrada com Google. Ela foi removida na etapa de acesso por e-mail de 2026-08-19 e não faz parte do estado atual do frontend.

---

## 2026-08-18 — Fundação do frontend

**Commit inicial:** `4250f9e`

### Adicionado

- Aplicação React com Vite, estrutura de rotas e tema visual próprio do EndoCare.
- Homepage editorial voltada à informação responsável sobre endometriose, com aviso clínico fixo e crédito ao aluno do SESI.
- Navegação entre fitoterapia, diário, EndoBot, blog e relatos.
- Visualização botânica de cúrcuma, gengibre e camomila, com imagens, modelo interativo sob demanda, créditos e texto alternativo.
- Diário local de sintomas com data explícita, intensidade de dor, humor, sangramento, medicação, notas, histórico e tendência visual.
- EndoBot para dúvidas gerais, limite de mensagem, lembrete de privacidade, bloqueio de dados pessoais e mensagem de indisponibilidade controlada.
- Blog informativo e seção de relatos reais com consentimento, avaliação de 0 a 5 estrelas, filtros visuais e estado vazio responsável.
- Estrutura de movimentos, animações, responsividade e preferências de redução de movimento.
- Componentes, estilos, testes e configuração de build do frontend.

---

## Convenções para próximas mudanças

Ao adicionar uma mudança relevante ao frontend, inclua uma entrada com a data, o commit ou pull request associado e uma seção adequada: **Adicionado**, **Alterado**, **Corrigido**, **Segurança** ou **Validado**. Evite registrar dados pessoais, segredos ou detalhes internos de infraestrutura neste arquivo.

## 2026-08-28 — Triagem automática conservadora de relatos

### Adicionado

- O envio de relatos passou a usar o endpoint autenticado `/api/report-triage` do backend Vercel, em vez de inserir diretamente pelo navegador.
- Filtros determinísticos detectam repetição evidente, pouco conteúdo, excesso de links e padrões promocionais ou de apostas. Relatos emocionais, informais ou com erros de escrita não são classificados como trollagem por essas regras.
- A classificação estruturada por IA usa três rótulos: `adequate`, `needs_review` e `likely_spam`. O resultado mínimo é armazenado em `community_stories` e aparece como indicador e filtro na fila administrativa.

### Proteções

- Todo relato continua com `status = pending` até a decisão de uma pessoa administradora. A triagem não publica, rejeita, apaga, pune nem diagnostica automaticamente.
- Se a IA estiver indisponível, houver resposta inválida ou ocorrer timeout, o relato é preservado para revisão humana com o sinal técnico `ai_check_unavailable`.
- O texto enviado ao modelo é tratado como dado não confiável e delimitado; prompts, respostas brutas e credenciais não são persistidos no banco. O endpoint exige sessão válida, conta ativa, origem permitida, limites de tamanho e rate limit por conta.

### Validação

- Testes do backend, build, type-check do frontend e suíte do frontend passaram. A suíte do frontend ficou com **124 testes em 39 arquivos**; a cobertura valida os rótulos, o fallback para revisão humana e a migração.

**Publicação:** frontend no commit `49d98d9`, deployment de produção `dpl_C9uumyqQtr7QcT9W7kSQh8r9A3oc` em `READY`; backend no commit `85e3525`, deployment de produção `dpl_Qj9KiA14W74VEaZx9JQJyJERgGvy` em `READY`.

## 2026-08-28 — Sitemap, meta descriptions e verificação do Search Console

### Adicionado

- O `client/public/sitemap.xml` foi revisado com URLs absolutas canônicas das páginas públicas: Home, Blog, FAQ, Termos e Privacidade.
- A Home recebeu a meta description principal e a tag `google-site-verification` fornecida pelo usuário.
- O novo componente `SeoMeta` aplica títulos, meta descriptions, canonical e descrições sociais específicas para Home, Blog, FAQ, Termos e Privacidade, com versões PT/EN/ES conforme o idioma selecionado.
- O segundo token emitido pelo fluxo atual do Google Search Console foi mantido junto ao token anterior, sem remover verificações existentes.

### Validação

- O XML do sitemap foi validado localmente; type-check, suíte Vitest, build de produção e `git diff --check` passaram.
- A propriedade `https://endo-acolhe.vercel.app/` foi verificada no Search Console pelo método Tag HTML após o deployment conter os dois tokens no HTML público. O sitemap foi enviado e aparece como **Processado**, com 5 páginas encontradas e 0 vídeos.


## 2026-08-28 — Exclusão de perguntas no painel

### Adicionado

- Os cards de perguntas do Questionário agora exibem a ação **Excluir**, com confirmação acessível antes da remoção.
- O controle usa a mesma autorização `manage_questionnaire` já aplicada pelo Supabase, mantém as avaliações existentes e atualiza a lista após a exclusão.
- A ação recebeu tratamento visual responsivo, foco visível e textos em português, inglês e espanhol, preservando o padrão acolhedor do painel.

### Validado

- Type-check, build de produção, `git diff --check` e suíte Vitest aprovados: **125 testes em 39 arquivos**.


## 2026-08-28 — Fallback NVIDIA do EndoBot

### Adicionado

- O fluxo do EndoBot agora conta com a NVIDIA como provedor de contingência quando o OpenRouter estiver indisponível, sem mudar a experiência normal quando o provedor principal responde.
- A configuração é feita exclusivamente no backend; nenhuma chave NVIDIA é incluída no bundle, no navegador ou nas respostas públicas.

### Segurança

- O fallback mantém as mesmas sanitizações, limites, bloqueios de segurança, validação de saída e supervisão humana do caminho principal. Se nenhum provedor puder responder, o site exibe a mensagem neutra de indisponibilidade.


## 2026-08-31 — Acompanhamento humano transparente e disponibilidade do EndoBot

### Corrigido

- O checkbox de autorização do acompanhamento humano foi removido. Para novas conversas autenticadas, o site mostra um aviso visível e localizado informando que a conversa pode ser acessada pelo Dono para suporte e segurança; o acompanhamento é limitado à conversa e não é monitoramento geral da conta.
- A opção de revogar o acompanhamento continua disponível na conversa ativa. Conversas antigas não são alteradas retroativamente.
- O health check do EndoBot agora considera também a NVIDIA. Assim, uma falha ou limite do OpenRouter não deixa o chat bloqueado quando o provedor de contingência está disponível.

### Segurança e transparência

- O aviso não é oculto e não transforma o acompanhamento em vigilância geral. A fila do Dono continua limitada às conversas elegíveis e às RPCs protegidas existentes.
- O backend mantém OpenRouter como primeira tentativa e NVIDIA como fallback, sem expor chaves, prompts ou erros internos.

### Validado

- Frontend: type-check, build e **125 testes aprovados em 39 arquivos**.
- Endpoint de produção do EndoBot: resposta benigna HTTP 200 confirmada após o fallback NVIDIA estar publicado.

## 2026-09-18 — Modo de voz acolhedor do EndoBot

- Adicionado botão de gravação com `MediaRecorder`, estados de gravação, processamento e reprodução, além de interrupção da reprodução atual.
- O áudio é enviado somente durante a requisição ao endpoint seguro de voz; o navegador mantém apenas o objeto temporário necessário para tocar a resposta.
- Incluídos avisos localizados em português, inglês e espanhol informando que a voz é gerada por IA e que dados pessoais não devem ser compartilhados.

## 2026-10-08 — Backup local com Qwen/Ollama

Foi criado um backup independente do frontend EndoCare para execução local com o backend `backend2-local-qwen-backup`. A URL da API agora pode ser definida por `VITE_API_BASE_URL`, permitindo usar `http://127.0.0.1:3000` sem alterar a versão publicada. Foram adicionados modelos de ambiente, scripts Windows de instalação/inicialização, documentação do Cloudflare Pages e instruções de privacidade.

## 2026-10-20 — Recuperação da voz e transcrição mais precisa

### Corrigido

- A síntese do OmniVoice agora tenta novamente em CPU quando a GPU apresenta erro do acelerador CUDA em modo automático, além do fallback que já existia para falta de memória. Na CPU, permanece o limite de 300 caracteres para evitar sínteses longas que não terminam dentro do prazo.
- A gravação do navegador solicita cancelamento de eco, redução de ruído, ganho automático e um canal de áudio, melhorando a captura de perguntas curtas.
- O reconhecimento local mudou do Whisper base para Whisper small, aumentou `beam_size` de 3 para 5 e ajustou o VAD para preservar pausas e as bordas das frases curtas.
- A reprodução desbloqueia o Web Audio durante o clique ou início da gravação, para que a espera pela síntese não perca a autorização temporária de áudio do navegador; o elemento de áudio continua como alternativa.

### Validado

- Teste local gerou um WAV OmniVoice válido de 24 kHz e 3 segundos. O Whisper small reconheceu uma amostra sintetizada de “Teste, está me ouvindo?” como “Teste está me ouvindo.”
- Testes locais do serviço de voz, type-check, build e teste do componente do EndoBot aprovados. A suíte do backend passou com **91 testes**; **2 testes opcionais de fault injection** foram pulados por dependerem de um proxy local.
