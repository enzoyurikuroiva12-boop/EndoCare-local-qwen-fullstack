-- Controles temporários, notificações privadas e auditoria de exclusão de contas.
alter table public.account_controls
  add column if not exists expires_at timestamptz;

alter table public.account_admin_actions
  add column if not exists expires_at timestamptz;

alter table public.account_controls
  drop constraint if exists account_controls_expires_at_check;
alter table public.account_controls
  add constraint account_controls_expires_at_check
  check (expires_at is null or status in ('restricted', 'suspended'));

create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('account_restricted', 'account_suspended', 'story_rejected', 'story_deleted')),
  message text not null check (char_length(message) between 3 and 600),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists account_notifications_user_created_idx on public.account_notifications(user_id, created_at desc);
alter table public.account_notifications enable row level security;
revoke all on public.account_notifications from anon;
grant select, update(read_at) on public.account_notifications to authenticated;
create policy "Pessoas leem somente as próprias notificações"
on public.account_notifications for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Pessoas marcam somente as próprias notificações"
on public.account_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.account_deletion_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  deleted_user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.account_deletion_actions enable row level security;
revoke all on public.account_deletion_actions from anon, authenticated;

create or replace function public.current_endoacolhe_account_control()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'status', case when control.expires_at is not null and control.expires_at <= now() then 'active' else control.status end,
      'reason', case when control.expires_at is not null and control.expires_at <= now() then null else control.reason end,
      'expires_at', case when control.expires_at is not null and control.expires_at <= now() then null else control.expires_at end
    )
    from public.account_controls control
    where control.user_id = auth.uid()
  ), '{"status":"active","reason":null,"expires_at":null}'::jsonb);
$$;

create or replace function public.is_endoacolhe_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.current_endoacolhe_account_control() ->> 'status') = 'active', true);
$$;

drop function if exists public.list_endoacolhe_accounts(text, text);
create function public.list_endoacolhe_accounts(p_search text default null, p_status text default 'all')
returns table (user_id uuid, display_name text, email text, created_at timestamptz, status text, reason text, updated_at timestamptz, is_administrator boolean, expires_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_endoacolhe_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('all', 'active', 'restricted', 'suspended') then raise exception 'invalid account status' using errcode = '22023'; end if;
  return query
  select directory.user_id, directory.display_name, directory.email, directory.created_at,
    case when control.expires_at is not null and control.expires_at <= now() then 'active' else coalesce(control.status, 'active') end,
    case when control.expires_at is not null and control.expires_at <= now() then null else control.reason end,
    control.updated_at,
    exists (select 1 from public.admin_users admin where admin.user_id = directory.user_id),
    case when control.expires_at is not null and control.expires_at <= now() then null else control.expires_at end
  from public.account_directory directory left join public.account_controls control on control.user_id = directory.user_id
  where (p_status = 'all' or (case when control.expires_at is not null and control.expires_at <= now() then 'active' else coalesce(control.status, 'active') end) = p_status)
    and (p_search is null or p_search = '' or directory.display_name ilike '%' || p_search || '%' or directory.email ilike '%' || p_search || '%')
  order by directory.created_at desc limit 100;
end;
$$;

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
  if p_next_status = 'active' then normalized_reason := null; effective_expires_at := null;
  elsif normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 300 then raise exception 'a reason between 3 and 300 characters is required' using errcode = '22023';
  elsif p_expires_at is not null and p_expires_at <= now() then raise exception 'expiry must be in the future' using errcode = '22023';
  else effective_expires_at := p_expires_at;
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

create or replace function public.moderate_endoacolhe_story(p_story_id uuid, p_next_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare story_owner uuid; next_value text;
begin
  if not public.is_endoacolhe_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_next_status not in ('approved', 'rejected') then raise exception 'invalid story status' using errcode = '22023'; end if;
  select owner_id into story_owner from public.community_stories where id = p_story_id for update;
  if story_owner is null then raise exception 'story not found' using errcode = 'P0002'; end if;
  update public.community_stories set status = p_next_status where id = p_story_id;
  if p_next_status = 'rejected' then insert into public.account_notifications (user_id, kind, message) values (story_owner, 'story_rejected', 'Seu relato não foi aprovado na revisão e não será publicado.'); end if;
  return jsonb_build_object('id', p_story_id, 'status', p_next_status);
end;
$$;

create or replace function public.delete_endoacolhe_content(p_content_type text, p_target_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare deleted_id uuid; story_owner uuid;
begin
  if not public.is_endoacolhe_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_content_type not in ('story', 'post') or p_target_id is null then raise exception 'invalid content target' using errcode = '22023'; end if;
  if p_content_type = 'story' then
    select owner_id into story_owner from public.community_stories where id = p_target_id for update;
    delete from public.community_stories where id = p_target_id returning id into deleted_id;
    if story_owner is not null then insert into public.account_notifications (user_id, kind, message) values (story_owner, 'story_deleted', 'Seu relato foi removido pela administração e não está mais disponível.'); end if;
  else delete from public.blog_posts where id = p_target_id returning id into deleted_id;
  end if;
  if deleted_id is null then raise exception 'content not found' using errcode = 'P0002'; end if;
  insert into public.admin_content_deletions (content_type, target_id, actor_user_id) values (p_content_type, deleted_id, auth.uid());
  return jsonb_build_object('content_type', p_content_type, 'id', deleted_id);
end;
$$;

revoke all on function public.current_endoacolhe_account_control() from public, anon;
revoke execute on function public.manage_endoacolhe_account(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.manage_endoacolhe_account(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.moderate_endoacolhe_story(uuid, text) from public, anon;
grant execute on function public.current_endoacolhe_account_control() to authenticated;
grant execute on function public.manage_endoacolhe_account(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.moderate_endoacolhe_story(uuid, text) to authenticated;
