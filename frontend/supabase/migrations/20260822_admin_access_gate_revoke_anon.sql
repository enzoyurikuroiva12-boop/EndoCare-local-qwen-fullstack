-- Corrige permissões padrão de execução para que as funções de acesso reforçado não aceitem chamadas anônimas.
revoke execute on function public.has_endoacolhe_admin_access() from public, anon;
revoke execute on function public.unlock_endoacolhe_admin_access(text) from public, anon;
grant execute on function public.has_endoacolhe_admin_access() to authenticated;
grant execute on function public.unlock_endoacolhe_admin_access(text) to authenticated;
