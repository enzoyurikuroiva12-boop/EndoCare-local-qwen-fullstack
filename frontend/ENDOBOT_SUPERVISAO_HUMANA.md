# Supervisão humana consentida do EndoBot

## Objetivo

Permitir que **somente o Dono** acompanhe, em tempo real, as conversas do EndoBot para as quais a própria pessoa tenha habilitado supervisão humana. O Dono poderá pausar o atendimento automático e responder como **Equipe humana do EndoCare**. A função não é um canal clínico, não realiza diagnóstico e não substitui atendimento profissional.

## Escopo e privacidade

| Item | Regra adotada |
| --- | --- |
| Quem vê conteúdo | Apenas a conta confirmada na tabela `endoacolhe_owners`, depois de passar pela autenticação e senha adicional do painel. |
| Conversas elegíveis | Apenas conversas autenticadas cujo titular tenha marcado o consentimento específico de supervisão antes do primeiro envio. Conversas anônimas e sem aceite permanecem inacessíveis. |
| Identidade exibida | O painel usa título, idioma, categoria, horário e estado. Não mostra e-mail; a identificação nominal fica fora da tela de supervisão. |
| Pausa | Pausa somente a resposta automática daquela conversa. A pessoa recebe um aviso claro, pode continuar lendo a conversa e pode encerrar ou apagar o histórico. |
| Resposta humana | É salva com papel `human`, rótulo visível de Equipe humana e sem alegar ser resposta automática. |
| Auditoria | Cada alteração de pausa e cada resposta humana registra ator, conversa, ação e data em tabela restrita. O painel não registra nem replica o conteúdo em logs administrativos. |

## Fluxos

1. A pessoa autenticada opta pela supervisão humana antes de iniciar uma nova conversa e lê o aviso específico de privacidade.
2. O EndoBot salva o aceite junto da conversa. Sem esse aceite, as políticas de banco não retornam a conversa ao Dono.
3. O Dono abre o painel exclusivo, desbloqueia a senha adicional e vê a lista de conversas elegíveis atualizada em tempo real.
4. Ao pausar, a automação daquela conversa fica bloqueada. A pessoa vê que uma integrante da equipe assumiu o atendimento.
5. O Dono pode enviar uma resposta humana identificada. A pessoa recebe a mensagem na própria conversa em tempo real.
6. Ao retomar, o EndoBot volta a responder apenas a novas mensagens. Todas as ações ficam auditadas.
7. Se a pessoa retirar o consentimento, a leitura futura pelo Dono é interrompida imediatamente e a conversa volta ao estado de automação; o histórico não é apagado por essa escolha.

## Direção visual

O módulo usa o caderno editorial do EndoCare: fundo de papel claro, blocos de leitura com bordas suaves e sinalização discreta. A marca de supervisão usa **azul-petróleo `#2E6F6B`**, estado pausado usa **âmbar `#9A5B13`**, e o conteúdo de intervenção humana fica assinado por um selo textual, em vez de depender apenas de cor. A área de conversa é funcionalmente densa, mas com hierarquia de “fila → conversa → ação” para reduzir o risco de intervenção na conversa errada.

## Controles de segurança

- As funções de listagem, pausa e resposta verificam `is_endoacolhe_owner()` no banco, e não aceitam identificadores de usuário fornecidos pelo navegador como autorização.
- A leitura de mensagens ocorre somente por uma função `security definer` que filtra `human_review_consent = true` e limita a paginação.
- O cliente não recebe e-mail, endereço IP, eventos de segurança, motivo de punição ou outro dado administrativo na fila.
- Mudanças usam transação e validam tamanho, papel e transição de estado antes de persistir.
- Eventos em tempo real usam as mesmas políticas RLS; a atualização periódica recarrega apenas a lista elegível quando necessária.

## Implementação aplicada em 27 de agosto de 2026

As migrações `20260827_endobot_human_supervision*.sql` foram aplicadas no projeto Supabase ativo. Elas adicionam o consentimento e estado por conversa, tabela privada de auditoria sem coluna de conteúdo, papéis `user`/`assistant`/`human`, RPCs de leitura e operação do Dono, RPC de revogação para a pessoa titular e gatilhos de sinal sem texto.

Para reduzir a superfície de dados no Realtime, o painel do Dono não assina `endobot_conversations` nem `endobot_messages`. Ele recebe um update de `admin_realtime_signal` somente quando uma conversa consentida muda; em seguida, consulta a fila e a conversa via RPC autorizado. A pessoa titular continua recebendo a mensagem humana na sua própria conversa pelas políticas privadas já existentes.

O backend recebe `conversationId` apenas para a conversa autenticada, valida UUID e titularidade com credencial server-side, testa a pausa antes de chamar o modelo e novamente antes de devolver a resposta. Respostas automáticas passaram a ser gravadas pelo backend, enquanto respostas humanas permanecem bloqueadas fora da operação exclusiva do Dono.
