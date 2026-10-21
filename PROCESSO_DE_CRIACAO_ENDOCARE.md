# Como o EndoCare nasceu

Este texto conta primeiro a ideia do projeto em linguagem simples. No final, há seções separadas sobre o que o site oferece, como funciona por dentro e como trata a privacidade.

## O que levou a gente a criar o site

O EndoCare foi criado por alunos do SESI com a vontade de falar sobre endometriose de um jeito claro, respeitoso e acolhedor. A ideia foi reunir informações gerais e recursos úteis em um só lugar para quem convive com a condição, tem dúvidas ou quer se preparar melhor para conversar com profissionais de saúde.

Além de informar, queríamos oferecer formas práticas de organizar o dia a dia: registrar sintomas, encontrar assuntos para ler e preparar perguntas para uma consulta. O site também busca acolher dúvidas sem fazer a pessoa se sentir julgada ou pressionada a compartilhar informações pessoais.

Desde o início, o EndoCare foi pensado como apoio educativo. Ele não foi criado para diagnosticar, indicar tratamentos ou substituir médicos e outros profissionais de saúde.

## Como a ideia foi tomando forma

O projeto começou com uma página de apresentação e algumas áreas centrais: conteúdo sobre endometriose, diário de sintomas, EndoBot, blog e espaço para relatos. Conforme o site cresceu, foram incluídos recursos para tornar a experiência mais completa, como acesso por conta, versões em português, inglês e espanhol, questionário, páginas de ajuda e informações sobre uso e privacidade.

Também foram feitos ajustes para que o site pudesse ser usado em diferentes tamanhos de tela e por mais pessoas. O EndoBot ganhou limites mais claros e a opção de encaminhar uma conversa para a equipe humana nas situações previstas pelo site. Mais tarde, foi acrescentada a possibilidade de conversar por voz.

Cada etapa procurou manter a mesma intenção: facilitar o acesso a informação, ajudar a pessoa a se organizar e deixar claros os limites do que o site e a inteligência artificial podem fazer.

# O que o site oferece

- **Conteúdo informativo:** páginas, vídeos, perguntas frequentes e artigos sobre endometriose.
- **Diário de sintomas:** espaço pessoal para anotar datas, dores, humor, sangramento, medicamentos e observações.
- **EndoBot:** conversa para perguntas gerais e para ajudar a organizar dúvidas para uma consulta. Pode receber perguntas faladas e ler respostas em voz alta.
- **Relatos e questionário:** espaços para compartilhar experiências ou responder às perguntas disponíveis, seguindo os avisos apresentados no site.
- **Equipe humana:** em conversas elegíveis do EndoBot, a equipe pode assumir o atendimento e responder com identificação humana.
- **Acessibilidade e idiomas:** interface em português, inglês e espanhol, com recursos de acessibilidade como VLibras e adaptação a telas menores.
- **Conta e área administrativa:** recursos privados para a pessoa usuária e ferramentas restritas para a equipe responsável pelo site.

# Parte técnica

Esta pasta contém uma versão preparada para uso local no Windows. A interface foi construída com React, TypeScript e Vite; a API usa Node.js e TypeScript. O modo local de conversa usa o modelo Qwen 2.5 3B pelo Ollama. O Supabase fornece serviços de conta e dados configurados para a aplicação.

Os arquivos `BAIXAR_ENDOCARE.bat`, `INICIAR_ENDOCARE.bat` e `ENCERRAR_ENDOCARE.bat` ajudam a instalar, abrir e fechar os serviços locais. O Ngrok pode criar um endereço temporário para acessar esse ambiente de outro computador, conforme a configuração da conta.

Na voz pt-BR deste computador, o EndoBot usa a voz feminina padrão do Windows, **Microsoft Maria Desktop**. O reconhecimento das gravações usa Whisper local. Se a voz brasileira do Windows não estiver disponível, o serviço pode usar o OmniVoice instalado como alternativa. Os documentos do projeto também registram uma versão publicada em nuvem, cuja infraestrutura e provedores de IA são diferentes do modo local.

# Privacidade e limites

- O Diário de sintomas fica salvo no navegador usado pela pessoa; esse recurso não envia as anotações para a conta.
- Informações de conta e recursos que dependem de login podem ser processados pelo Supabase configurado para o site. O e-mail não aparece publicamente.
- Conversas autenticadas do EndoBot podem ser vistas pelo responsável do EndoCare quando necessário, conforme o aviso apresentado no próprio site. Respostas humanas aparecem identificadas como equipe.
- Relatos só devem ser publicados com autorização e passam por revisão antes da publicação.
- Os arquivos `.env` guardam configurações privadas e não devem ser publicados no GitHub. Não inclua senhas, tokens, dados pessoais ou informações de saúde desnecessárias nas mensagens.
- O EndoBot pode errar. Suas respostas são informativas e não substituem avaliação, diagnóstico, tratamento ou atendimento de urgência.

## Materiais consultados

- [README do projeto](README.md) — instalação e uso local.
- [Histórico de mudanças](frontend/CHANGELOG.md) — etapas e recursos adicionados ao site.
- [Configuração de autenticação](frontend/CONFIGURAR_AUTENTICACAO.md) — contas e acesso.
- [Supervisão humana do EndoBot](frontend/ENDOBOT_SUPERVISAO_HUMANA.md) — funcionamento da equipe humana e controles de acesso.
- [Acervo de referência do EndoBot](backend/README_RAG.md) — informações usadas para responder às perguntas.
- [Voz local](backend/local-voice/README.md) — fala e reconhecimento de voz.
