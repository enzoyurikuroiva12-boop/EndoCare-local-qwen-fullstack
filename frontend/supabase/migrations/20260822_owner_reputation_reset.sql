-- Restauração excepcional de reputação: somente o Dono pode remover o histórico de punições de uma conta comum.
create or replace function public.reset_endoacolhe_account_reputation(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can reset account reputation' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'the owner cannot reset this account from the panel' using errcode = '22023';
  end if;

  if not exists (select 1 from public.account_directory where user_id = p_target_user_id) then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.admin_users where user_id = p_target_user_id)
    or exists (select 1 from public.endoacolhe_owners where user_id = p_target_user_id) then
    raise exception 'staff accounts cannot have punishment history reset from this panel' using errcode = '22023';
  end if;

  delete from public.account_admin_actions
  where target_user_id = p_target_user_id;
  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'no punishment history found for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'deleted_punishment_records', deleted_count
  );
end;
$$;

revoke all on function public.reset_endoacolhe_account_reputation(uuid) from public, anon;
grant execute on function public.reset_endoacolhe_account_reputation(uuid) to authenticated;
