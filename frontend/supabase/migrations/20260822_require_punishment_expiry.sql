create or replace function public.manage_endoacolhe_account(p_target_user_id uuid, p_next_status text, p_reason text default null, p_expires_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare current_status text; normalized_reason text; effective_expires_at timestamptz;
begin
  if not public.is_endoacolhe_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then raise exception 'administrators cannot manage their own account here' using errcode = '22023'; end if;
  if exists (select 1 from public.admin_users where user_id = p_target_user_id) then raise exception 'administrator accounts require out-of-band management' using errcode = '22023'; end if;
  if p_next_status not in ('active', 'restricted', 'suspended') then raise exception 'invalid account status' using errcode = '22023'; end if;
  if not exists (select 1 from public.account_directory where user_id = p_target_user_id) then raise exception 'account not found' using errcode = 'P0002'; end if;

  normalized_reason := nullif(btrim(p_reason), '');
  if p_next_status = 'active' then
    normalized_reason := null; effective_expires_at := null;
  elsif normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 300 then
    raise exception 'a reason between 3 and 300 characters is required' using errcode = '22023';
  elsif p_expires_at is null or p_expires_at <= now() then
    raise exception 'a future expiry is required' using errcode = '22023';
  else
    effective_expires_at := p_expires_at;
  end if;

  select coalesce(status, 'active') into current_status from public.account_controls where user_id = p_target_user_id;
  current_status := coalesce(current_status, 'active');
  insert into public.account_controls (user_id, status, reason, expires_at, updated_at, updated_by)
  values (p_target_user_id, p_next_status, normalized_reason, effective_expires_at, now(), auth.uid())
  on conflict (user_id) do update set status = excluded.status, reason = excluded.reason, expires_at = excluded.expires_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into public.account_admin_actions (target_user_id, actor_user_id, previous_status, next_status, reason, expires_at)
  values (p_target_user_id, auth.uid(), current_status, p_next_status, normalized_reason, effective_expires_at);
  if p_next_status = 'restricted' then
    insert into public.account_notifications (user_id, kind, message) values (p_target_user_id, 'account_restricted', 'Sua conta está Restrita. Por favor, contate um administrador para saber o motivo.');
  elsif p_next_status = 'suspended' then
    insert into public.account_notifications (user_id, kind, message) values (p_target_user_id, 'account_suspended', 'Sua conta foi suspensa. Por favor, contate um administrador para saber o motivo.');
  end if;
  return jsonb_build_object('user_id', p_target_user_id, 'previous_status', current_status, 'status', p_next_status, 'expires_at', effective_expires_at);
end;
$$;
