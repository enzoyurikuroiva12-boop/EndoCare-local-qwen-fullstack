# Configuração de autenticação — EndoCare

O frontend oferece entrada com **e-mail e senha** e, opcionalmente, com **Google**. O login existente não solicita código nem magic link: a pessoa informa o e-mail e a senha cadastrada. O cadastro é separado e envia um link de confirmação por e-mail antes de liberar a conta, conforme a configuração do Supabase Auth.

## 1. Login por e-mail e senha

No Supabase, abra **Authentication → Sign In / Providers** e mantenha o provedor de e-mail habilitado. O frontend chama `signInWithPassword({ email, password })` no componente `AuthDialog.tsx`.

O campo de senha usa `autocomplete="current-password"`, possui controle de mostrar/ocultar senha e não revela a senha para a administração. O frontend normaliza o e-mail para minúsculas antes de enviá-lo, mas a senha é enviada exatamente como foi digitada.

O limitador local de tentativas usa a ação `email-login`. Os limites efetivos contra abuso devem permanecer ativos no Supabase em **Authentication → Rate Limits**. Erros de login são apresentados com uma mensagem genérica para não confirmar se determinado e-mail está cadastrado.

## 2. Cadastro por e-mail com confirmação por link

No Supabase, abra **Authentication → Sign In / Providers** e mantenha **Confirm email** ativado. O frontend chama `signUp` com e-mail, senha, nome informado e os metadados das versões vigentes de **Termos de Uso** e **Política de Privacidade**, usando `emailRedirectTo` igual à origem atual do site.

Antes de liberar o botão de cadastro, a pessoa precisa marcar os dois campos de aceite. Os documentos são públicos em `/termos` e `/privacidade`; a interface mantém as versões enviadas no cadastro e a origem `web`. Senhas, conteúdo do Diário, Questionário e conversas não fazem parte desse metadata.

Depois do cadastro, o EndoCare informa que um link de confirmação foi enviado. A pessoa deve abrir o e-mail e clicar no link para ativar a conta e entrar. O diálogo não pede código manual. O modelo de e-mail deve priorizar `{{ .ConfirmationURL }}`; não é necessário depender de `{{ .Token }}` como código digitado na interface.

O botão de reenvio usa `auth.resend({ type: "signup" })` e o limitador local usa a ação `resend-link`. O frontend orienta a pessoa a conferir também a pasta de spam. Os limites efetivos contra abuso devem continuar ativos no Supabase.

## 3. Recuperação de senha

A opção **Esqueci minha senha** chama `resetPasswordForEmail` e envia um link privado para a pessoa escolher uma nova senha. A administração não vê nem armazena senhas. O limitador local usa a ação `password-recovery-request`.

O redirect de recuperação aponta para a origem do site. O fluxo de atualização da senha deve continuar protegido pelo Supabase Auth e por uma política de senha forte no frontend.

## 4. Entrada com Google

No Google Cloud Console, crie um cliente OAuth do tipo **Aplicativo da Web**. Em **Authorized redirect URIs**, use exatamente:

```text
https://bhebvxqlovhsykfmxeln.supabase.co/auth/v1/callback
```

Depois, em **Supabase → Authentication → Sign In / Providers → Google**, ative o provedor e preencha Client ID e Client Secret. Em **Authentication → URL Configuration**, o Site URL e o URL permitido de produção são:

```text
https://endo-acolhe.vercel.app
```

Nunca registre Client Secret, `SUPABASE_SERVICE_ROLE_KEY` ou `OPENROUTER_API_KEY` no GitHub, no frontend ou em arquivos `.env` versionados.

## 5. Checklist de validação

Após alterar autenticação, validar o fluxo com uma conta de teste sem usar dados reais:

1. Abrir o diálogo e confirmar que o login mostra campos de e-mail e senha.
2. Usar credenciais válidas e confirmar o fechamento do diálogo após sucesso.
3. Usar senha inválida e confirmar que a mensagem não revela detalhes internos.
4. Acessar o cadastro e confirmar que o envio fica bloqueado até o aceite dos dois documentos.
5. Abrir `/termos` e `/privacidade`, marcar os dois aceites, confirmar o envio do link e verificar a pasta de spam.
6. Reenviar a confirmação e verificar o limitador.
7. Testar recuperação de senha sem expor a existência da conta.
8. Rodar testes, type-check e build antes do commit.
9. Atualizar `frontend/CHANGELOG.md` e `DOCUMENTACAO_TECNICA_JUDICIAL_ENDOACOLHE.md` no mesmo ciclo da alteração.
