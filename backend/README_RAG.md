# Acervo de referência do EndoBot

O EndoBot consulta o Supabase Storage configurado nas credenciais de servidor de `backend/.env`. O bucket vem de `SUPABASE_KNOWLEDGE_BUCKET`; quando essa variável não existe, o nome utilizado é `Knowledges`. O acervo não depende de uma pasta local de PDFs ou JSONs.

Na auditoria de 10/10/2026, o bucket `Knowledges` continha 19 arquivos JSON, com 3.714.389 bytes e 5.298 registros textuais. Todos foram carregados e indexados. Dois arquivos eram ignorados pelo limite anterior de 350 KB: `03_flower_2012_chinese_herbal_medicine_endometriosis.json` e `6.json`. A recuperação de conteúdo desses dois arquivos foi verificada com consultas específicas.

`lib/knowledge.ts` pagina a listagem inteira do Storage, percorre subpastas e carrega todos os arquivos com extensão `.json`, sem limitar o acervo a 24 arquivos ou descartar arquivos maiores que 350 KB. Aceita listas de registros `{ text: "..." }`, listas de strings, objetos com `chunks` e objetos com `text`. Textos extensos são divididos em trechos de até 1.200 caracteres, com sobreposição de 150 caracteres; o final do texto é preservado.

Os termos são indexados uma vez por projeto e bucket. Perguntas seguintes consultam esse índice e selecionam até quatro trechos relacionados à pergunta. O contexto enviado ao modelo mantém o limite de 3.600 caracteres de trechos, além da instrução de segurança. Indexar todos os documentos não significa enviar todo o acervo em cada chamada ao Qwen.

O índice completo fica em cache por cinco minutos. Solicitações simultâneas compartilham o mesmo carregamento. Após a expiração, a próxima pergunta inicia uma atualização em segundo plano e usa o último índice completo durante essa atualização. O novo índice só substitui o anterior depois que todos os JSONs forem carregados. Uma atualização que falha é tentada novamente após dez segundos, preservando o índice completo anterior.

`warmKnowledgeCache(supabase, bucket)` prepara o índice e retorna contagens de arquivos, bytes, trechos e termos. O servidor local utiliza essa função na inicialização. Quando ainda não há índice pronto, uma pergunta clínica aguarda a consulta ao acervo por até cinco segundos, configuráveis por `ENDOBOT_KNOWLEDGE_TIMEOUT_MS`. Se o carregamento falhar ou exceder o orçamento, a API retorna `503 knowledge_unavailable` com `retryable: true`; a pessoa pode tentar novamente. Saudações, agradecimentos e mensagens de teste recebem uma resposta breve sem conteúdo clínico recuperado.

Na verificação real depois da correção, carregar e indexar os 19 JSONs levou 1.188 ms. A primeira busca levou 15 ms; as buscas seguintes da mesma pergunta ficaram entre 0,25 e 0,58 ms. A pergunta de teste sobre dor pélvica retornou trechos de `2.json`, `3.json` e `06_marques_2022_fitoterapia_endometriose.json`. Esses tempos medem a recuperação do acervo, sem incluir a geração da resposta pelo Qwen, e dependem da conexão e da carga da máquina.

Para diagnosticar a integração, `ENDOBOT_RAG_DEBUG=true` habilita um registro interno com bucket, duração da recuperação, número de trechos, arquivos selecionados e tamanho do contexto. O registro não inclui a pergunta, o conteúdo dos trechos ou as credenciais. A opção exige reiniciar o backend quando definida no `.env`.

Validação automatizada: `pnpm.cmd exec vitest run lib/knowledge.test.ts api/endobot.local.test.ts`. Os testes cobrem paginação, subpastas, arquivos acima do antigo limite, textos extensos, carregamento compartilhado, atualização do cache, recuperação após falha e inclusão do contexto clínico nas mensagens enviadas ao modelo.
