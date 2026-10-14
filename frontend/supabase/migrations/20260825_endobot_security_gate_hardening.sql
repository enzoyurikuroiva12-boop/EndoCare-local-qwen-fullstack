-- Reforça o gate de segunda etapa em todos os caminhos administrativos.
-- Nenhuma função deste arquivo recebe ou armazena texto de chat, chaves ou senhas.

create or replace function public.is_endoacolhe_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_endoacolhe_admin_access();
$$;

create or replace function public.has_endoacolhe_permission(p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_role text;
begin
  if not public.has_endoacolhe_admin_access() then return false; end if;
  active_role := public.current_endoacolhe_admin_role();
  if active_role = 'owner' then return true; end if;
  if active_role = 'admin' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'content_manage', 'blog_manage', 'support_chat', 'view_punishment_logs'); end if;
  if active_role = 'moderator' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'support_chat', 'view_punishment_logs'); end if;
  if active_role = 'support' then return p_permission in ('support_chat', 'view_punishment_logs'); end if;
  return false;
end;
$$;

create or replace function public.is_endoacolhe_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_endoacolhe_admin_access()
    and exists (select 1 from public.endoacolhe_owners owner where owner.user_id = auth.uid());
$$;

-- A assinatura original não continha os campos de classificação. O drop explícito
-- permite recriar o RPC sem depender de CREATE OR REPLACE incompatível com RETURNS TABLE.
drop function if exists public.list_endoacolhe_endobot_security_events();
create function public.list_endoacolhe_endobot_security_events()
returns table (
  id uuid,
  created_at timestamptz,
  user_name text,
  user_email text,
  ip_fingerprint text,
  signals text[],
  category text,
  severity text,
  risk_score smallint,
  source text,
  action text,
  expires_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can view EndoBot security events' using errcode = '42501'; end if;
  return query
  select event.id, event.created_at, directory.display_name, directory.email,
    event.ip_fingerprint, event.signals, event.category, event.severity,
    event.risk_score, event.source, event.action, event.expires_at, event.reviewed_at
  from public.endobot_security_events event
  left join public.account_directory directory on directory.user_id = event.user_id
  order by event.created_at desc
  limit 200;
end;
$$;

create or replace function public.review_endoacolhe_endobot_security_event(p_event_id uuid, p_clear_ip_block boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_fingerprint text;
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can review EndoBot security events' using errcode = '42501'; end if;
  if p_event_id is null then raise exception 'security event not found' using errcode = 'P0002'; end if;
  select ip_fingerprint into target_fingerprint
  from public.endobot_security_events
  where id = p_event_id
  for update;
  if target_fingerprint is null then raise exception 'security event not found' using errcode = 'P0002'; end if;
  update public.endobot_security_events
  set reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_event_id;
  if p_clear_ip_block then delete from public.endobot_ip_blocks where ip_fingerprint = target_fingerprint; end if;
  return jsonb_build_object('event_id', p_event_id, 'ip_block_cleared', p_clear_ip_block);
end;
$$;

revoke all on public.endobot_security_events, public.endobot_ip_blocks from anon, authenticated;
revoke all on function public.is_endoacolhe_admin() from public, anon;
revoke all on function public.is_endoacolhe_owner() from public, anon;
revoke all on function public.has_endoacolhe_permission(text) from public, anon;
revoke all on function public.list_endoacolhe_endobot_security_events() from public, anon;
revoke all on function public.review_endoacolhe_endobot_security_event(uuid, boolean) from public, anon;
grant execute on function public.is_endoacolhe_admin() to authenticated;
grant execute on function public.is_endoacolhe_owner() to authenticated;
grant execute on function public.has_endoacolhe_permission(text) to authenticated;
grant execute on function public.list_endoacolhe_endobot_security_events() to authenticated;
grant execute on function public.review_endoacolhe_endobot_security_event(uuid, boolean) to authenticated;
