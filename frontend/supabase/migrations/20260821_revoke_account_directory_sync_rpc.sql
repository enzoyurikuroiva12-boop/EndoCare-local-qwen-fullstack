-- A sincronização é acionada exclusivamente pelo trigger em auth.users.
-- Não deve ser exposta pela API RPC, mesmo para pessoas autenticadas.
revoke all on function public.sync_endoacolhe_account_directory() from public, anon, authenticated;
