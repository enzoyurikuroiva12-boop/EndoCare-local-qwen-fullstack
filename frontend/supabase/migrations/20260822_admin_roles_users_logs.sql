-- Papéis operacionais: Dono gerencia cargos; Suporte atende; Moderador atende, modera e pune; Admin opera as demais áreas.
alter table public.admin_users add column if not exists role text not null default 'admin';
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('support', 'moderator', 'admin'));
update public.admin_users set role = 'admin' where role is null or role not in ('support', 'moderator', 'admin');

alter table public.admin_role_actions add column if not exists previous_role text;
alter table public.admin_role_actions add column if not exists next_role text;

create or replace function public.current_endoacolhe_admin_role()
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.endoacolhe_owners owner where owner.user_id = auth.uid()) then 'owner'
    else (select admin.role from public.admin_users admin where admin.user_id = auth.uid())
  end;
$$;

create or replace function public.has_endoacolhe_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare active_role text;
begin
  active_role := public.current_endoacolhe_admin_role();
  if active_role = 'owner' then return true; end if;
  if active_role = 'admin' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'content_manage', 'blog_manage', 'support_chat', 'view_punishment_logs'); end if;
  if active_role = 'moderator' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'support_chat', 'view_punishment_logs'); end if;
  if active_role = 'support' then return p_permission in ('support_chat', 'view_punishment_logs'); end if;
  return false;
end;
$$;

create or replace function public.is_endoacolhe_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_endoacolhe_admin_role() is not null;
$$;

drop function if exists public.list_endoacolhe_accounts(text, text);
create function public.list_endoacolhe_accounts(p_search text default null, p_status text default 'all')
returns table (
  user_id uuid, display_name text, email text, created_at timestamptz, status text, reason text, updated_at timestamptz,
  is_administrator boolean, expires_at timestamptz, is_owner boolean, admin_role text, punishment_count integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_endoacolhe_permission('view_users') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('all', 'active', 'restricted', 'suspended') then raise exception 'invalid account status' using errcode = '22023'; end if;
  return query
  select directory.user_id, directory.display_name, directory.email, directory.created_at,
    case when control.expires_at is not null and control.expires_at <= now() then 'active' else coalesce(control.status, 'active') end,
    case when control.expires_at is not null and control.expires_at <= now() then null else control.reason end,
    control.updated_at, admin.role is not null,
    case when control.expires_at is not null and control.expires_at <= now() then null else control.expires_at end,
    owner.user_id is not null, admin.role,
    coalesce((select count(*)::integer from public.account_admin_actions action where action.target_user_id = directory.user_id and action.next_status in ('restricted', 'suspended')), 0)
  from public.account_directory directory
  left join public.account_controls control on control.user_id = directory.user_id
  left join public.admin_users admin on admin.user_id = directory.user_id
  left join public.endoacolhe_owners owner on owner.user_id = directory.user_id
  where (p_status = 'all' or (case when control.expires_at is not null and control.expires_at <= now() then 'active' else coalesce(control.status, 'active') end) = p_status)
    and (p_search is null or p_search = '' or directory.display_name ilike '%' || p_search || '%' or directory.email ilike '%' || p_search || '%')
  order by directory.created_at desc limit 100;
end;
$$;

create or replace function public.list_endoacolhe_punishment_log()
returns table (
  id uuid, actor_name text, actor_email text, target_name text, target_email text, previous_status text, next_status text, reason text, created_at timestamptz, expires_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_endoacolhe_permission('view_punishment_logs') then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select action.id, actor.display_name, actor.email, target.display_name, target.email, action.previous_status, action.next_status, action.reason, action.created_at, action.expires_at
  from public.account_admin_actions action
  left join public.account_directory actor on actor.user_id = action.actor_user_id
  left join public.account_directory target on target.user_id = action.target_user_id
  order by action.created_at desc limit 200;
end;
$$;

create or replace function public.manage_endoacolhe_account(p_target_user_id uuid, p_next_status text, p_reason text default null, p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare current_status text; normalized_reason text; effective_expires_at timestamptz;
begin
  if not public.has_endoacolhe_permission('apply_punishments') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then raise exception 'administrators cannot manage their own account here' using errcode = '22023'; end if;
  if exists (select 1 from public.admin_users where user_id = p_target_user_id) or exists (select 1 from public.endoacolhe_owners where user_id = p_target_user_id) then raise exception 'staff accounts require owner management' using errcode = '22023'; end if;
  if p_next_status not in ('active', 'restricted', 'suspended') then raise exception 'invalid account status' using errcode = '22023'; end if;
  if not exists (select 1 from public.account_directory where user_id = p_target_user_id) then raise exception 'account not found' using errcode = 'P0002'; end if;
  normalized_reason := nullif(btrim(p_reason), '');
  if p_next_status = 'active' then normalized_reason := null; effective_expires_at := null;
  elsif normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 300 then raise exception 'a reason between 3 and 300 characters is required' using errcode = '22023';
  elsif p_expires_at is null or p_expires_at <= now() then raise exception 'a future expiry is required' using errcode = '22023';
  else effective_expires_at := p_expires_at;
  end if;
  select coalesce(status, 'active') into current_status from public.account_controls where user_id = p_target_user_id;
  current_status := coalesce(current_status, 'active');
  insert into public.account_controls (user_id, status, reason, expires_at, updated_at, updated_by) values (p_target_user_id, p_next_status, normalized_reason, effective_expires_at, now(), auth.uid())
  on conflict (user_id) do update set status = excluded.status, reason = excluded.reason, expires_at = excluded.expires_at, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into public.account_admin_actions (target_user_id, actor_user_id, previous_status, next_status, reason, expires_at) values (p_target_user_id, auth.uid(), current_status, p_next_status, normalized_reason, effective_expires_at);
  if p_next_status = 'restricted' then insert into public.account_notifications (user_id, kind, message) values (p_target_user_id, 'account_restricted', 'Sua conta está Restrita. Por favor, contate um administrador para saber o motivo.');
  elsif p_next_status = 'suspended' then insert into public.account_notifications (user_id, kind, message) values (p_target_user_id, 'account_suspended', 'Sua conta foi suspensa. Por favor, contate um administrador para saber o motivo.'); end if;
  return jsonb_build_object('user_id', p_target_user_id, 'previous_status', current_status, 'status', p_next_status, 'expires_at', effective_expires_at);
end;
$$;

create or replace function public.moderate_endoacolhe_story(p_story_id uuid, p_next_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare story_owner uuid;
begin
  if not public.has_endoacolhe_permission('moderate_stories') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_next_status not in ('approved', 'rejected') then raise exception 'invalid story status' using errcode = '22023'; end if;
  select owner_id into story_owner from public.community_stories where id = p_story_id for update;
  if story_owner is null then raise exception 'story not found' using errcode = 'P0002'; end if;
  update public.community_stories set status = p_next_status where id = p_story_id;
  if p_next_status = 'rejected' then insert into public.account_notifications (user_id, kind, message) values (story_owner, 'story_rejected', 'Seu relato não foi aprovado na revisão e não será publicado.'); end if;
  return jsonb_build_object('id', p_story_id, 'status', p_next_status);
end;
$$;

create or replace function public.delete_endoacolhe_content(p_content_type text, p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare deleted_id uuid; story_owner uuid; previous_story_status text;
begin
  if not public.has_endoacolhe_permission('content_manage') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_content_type not in ('story', 'post') or p_target_id is null then raise exception 'invalid content target' using errcode = '22023'; end if;
  if p_content_type = 'story' then
    select owner_id, status into story_owner, previous_story_status from public.community_stories where id = p_target_id for update;
    delete from public.community_stories where id = p_target_id returning id into deleted_id;
    if story_owner is not null and previous_story_status = 'approved' then insert into public.account_notifications (user_id, kind, message) values (story_owner, 'story_deleted', 'Seu relato publicado foi removido pela administração e não está mais disponível.');
    elsif story_owner is not null and previous_story_status = 'pending' then insert into public.account_notifications (user_id, kind, message) values (story_owner, 'story_deleted', 'Seu relato enviado foi removido antes da conclusão da revisão.'); end if;
  else delete from public.blog_posts where id = p_target_id returning id into deleted_id; end if;
  if deleted_id is null then raise exception 'content not found' using errcode = 'P0002'; end if;
  insert into public.admin_content_deletions (content_type, target_id, actor_user_id) values (p_content_type, deleted_id, auth.uid());
  return jsonb_build_object('content_type', p_content_type, 'id', deleted_id);
end;
$$;

create or replace function public.manage_endoacolhe_staff_role(p_target_user_id uuid, p_next_role text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare previous_role text;
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can manage staff roles' using errcode = '42501'; end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then raise exception 'the owner role cannot be changed from this panel' using errcode = '22023'; end if;
  if not exists (select 1 from public.account_directory where user_id = p_target_user_id) then raise exception 'account not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.endoacolhe_owners where user_id = p_target_user_id) then raise exception 'the owner role cannot be changed from this panel' using errcode = '22023'; end if;
  if p_next_role is not null and p_next_role not in ('support', 'moderator', 'admin') then raise exception 'invalid staff role' using errcode = '22023'; end if;
  select role into previous_role from public.admin_users where user_id = p_target_user_id;
  if p_next_role is null then delete from public.admin_users where user_id = p_target_user_id;
  else insert into public.admin_users (user_id, role, created_by) values (p_target_user_id, p_next_role, auth.uid()) on conflict (user_id) do update set role = excluded.role, created_by = excluded.created_by; end if;
  insert into public.admin_role_actions (actor_user_id, target_user_id, action, previous_role, next_role) values (auth.uid(), p_target_user_id, case when p_next_role is null then 'revoked' else 'granted' end, previous_role, p_next_role);
  return jsonb_build_object('user_id', p_target_user_id, 'previous_role', previous_role, 'role', p_next_role);
end;
$$;

drop policy if exists "Administradores leem artigos completos" on public.blog_posts;
drop policy if exists "Somente administradores criam artigos" on public.blog_posts;
drop policy if exists "Somente administradores alteram artigos" on public.blog_posts;
drop policy if exists "Somente administradores removem artigos" on public.blog_posts;
create policy "Equipe com conteúdo lê artigos completos" on public.blog_posts for select to authenticated using ((select public.has_endoacolhe_permission('blog_manage')) or status = 'published');
create policy "Equipe com conteúdo cria artigos" on public.blog_posts for insert to authenticated with check ((select public.has_endoacolhe_permission('blog_manage')));
create policy "Equipe com conteúdo altera artigos" on public.blog_posts for update to authenticated using ((select public.has_endoacolhe_permission('blog_manage'))) with check ((select public.has_endoacolhe_permission('blog_manage')));
create policy "Equipe com conteúdo remove artigos" on public.blog_posts for delete to authenticated using ((select public.has_endoacolhe_permission('blog_manage')));

drop policy if exists "Administradores leem relatos em moderação" on public.community_stories;
drop policy if exists "Administradores moderam relatos" on public.community_stories;
create policy "Moderadores leem relatos em moderação" on public.community_stories for select to authenticated using ((select public.has_endoacolhe_permission('moderate_stories')) or status = 'approved' or owner_id = (select auth.uid()));
create policy "Moderadores alteram relatos" on public.community_stories for update to authenticated using ((select public.has_endoacolhe_permission('moderate_stories'))) with check ((select public.has_endoacolhe_permission('moderate_stories')));

drop policy if exists "Solicitantes e administradores leem atendimentos de conta" on public.account_support_threads;
drop policy if exists "Somente administradores encerram atendimentos de conta" on public.account_support_threads;
drop policy if exists "Participantes leem mensagens de atendimento" on public.account_support_messages;
drop policy if exists "Solicitante ou administração enviam mensagens de atendimento" on public.account_support_messages;
create policy "Participantes de suporte leem atendimentos" on public.account_support_threads for select to authenticated using ((select auth.uid()) = requester_id or (select public.has_endoacolhe_permission('support_chat')));
create policy "Equipe de suporte encerra atendimentos" on public.account_support_threads for update to authenticated using ((select public.has_endoacolhe_permission('support_chat'))) with check ((select public.has_endoacolhe_permission('support_chat')));
create policy "Participantes de suporte leem mensagens" on public.account_support_messages for select to authenticated using (exists (select 1 from public.account_support_threads thread where thread.id = thread_id and (thread.requester_id = (select auth.uid()) or (select public.has_endoacolhe_permission('support_chat')))));
create policy "Participantes de suporte enviam mensagens" on public.account_support_messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.account_support_threads thread where thread.id = thread_id and thread.status = 'open' and (thread.requester_id = (select auth.uid()) or (select public.has_endoacolhe_permission('support_chat')))));

revoke all on function public.current_endoacolhe_admin_role() from public, anon;
revoke all on function public.has_endoacolhe_permission(text) from public, anon;
revoke all on function public.list_endoacolhe_punishment_log() from public, anon;
revoke all on function public.manage_endoacolhe_staff_role(uuid, text) from public, anon;
grant execute on function public.current_endoacolhe_admin_role() to authenticated;
grant execute on function public.has_endoacolhe_permission(text) to authenticated;
grant execute on function public.list_endoacolhe_accounts(text, text) to authenticated;
grant execute on function public.list_endoacolhe_punishment_log() to authenticated;
grant execute on function public.manage_endoacolhe_account(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.moderate_endoacolhe_story(uuid, text) to authenticated;
grant execute on function public.delete_endoacolhe_content(text, uuid) to authenticated;
grant execute on function public.manage_endoacolhe_staff_role(uuid, text) to authenticated;
