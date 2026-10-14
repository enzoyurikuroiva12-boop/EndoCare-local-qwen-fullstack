-- Gerenciamento administrativo de contas para EndoAcolhe.
-- Execute no Supabase SQL Editor após o schema.sql principal.
-- Esta migração não dá ao frontend acesso direto a auth.users.

create table if not exists public.account_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'restricted', 'suspended')),
  reason text check (reason is null or char_length(reason) between 3 and 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check ((status = 'active' and reason is null) or status in ('restricted', 'suspended'))
);

create table if not exists public.account_admin_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('active', 'restricted', 'suspended')),
  next_status text not null check (next_status in ('active', 'restricted', 'suspended')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists account_controls_status_updated_idx on public.account_controls(status, updated_at desc);
create index if not exists account_actions_target_created_idx on public.account_admin_actions(target_user_id, created_at desc);

insert into public.account_directory (user_id, display_name, email, created_at, updated_at)
select id, coalesce(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'given_name'), email, created_at, now()
from auth.users
on conflict (user_id) do update set
  display_name = excluded.display_name,
  email = excluded.email,
  updated_at = now();

create or replace function public.sync_endoacolhe_account_directory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_directory (user_id, display_name, email, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'given_name'),
    new.email,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_endoacolhe_account_directory on auth.users;
create trigger sync_endoacolhe_account_directory
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_endoacolhe_account_directory();

create or replace function public.is_endoacolhe_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.account_controls where user_id = auth.uid()), true);
$$;

create or replace function public.list_endoacolhe_accounts(p_search text default null, p_status text default 'all')
returns table (
  user_id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  status text,
  reason text,
  updated_at timestamptz,
  is_administrator boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_endoacolhe_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_status not in ('all', 'active', 'restricted', 'suspended') then
    raise exception 'invalid account status' using errcode = '22023';
  end if;

  return query
  select directory.user_id,
    directory.display_name,
    directory.email,
    directory.created_at,
    coalesce(control.status, 'active') as status,
    control.reason,
    control.updated_at,
    exists (select 1 from public.admin_users admin where admin.user_id = directory.user_id) as is_administrator
  from public.account_directory directory
  left join public.account_controls control on control.user_id = directory.user_id
  where (p_status = 'all' or coalesce(control.status, 'active') = p_status)
    and (p_search is null or p_search = '' or directory.display_name ilike '%' || p_search || '%' or directory.email ilike '%' || p_search || '%')
  order by directory.created_at desc
  limit 100;
end;
$$;

create or replace function public.manage_endoacolhe_account(p_target_user_id uuid, p_next_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  normalized_reason text;
begin
  if not public.is_endoacolhe_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'administrators cannot manage their own account here' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_users where user_id = p_target_user_id) then
    raise exception 'administrator accounts require out-of-band management' using errcode = '22023';
  end if;
  if p_next_status not in ('active', 'restricted', 'suspended') then
    raise exception 'invalid account status' using errcode = '22023';
  end if;
  if not exists (select 1 from public.account_directory where user_id = p_target_user_id) then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  normalized_reason := nullif(btrim(p_reason), '');
  if p_next_status = 'active' then
    normalized_reason := null;
  elsif normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 300 then
    raise exception 'a reason between 3 and 300 characters is required' using errcode = '22023';
  end if;

  select coalesce(status, 'active') into current_status from public.account_controls where user_id = p_target_user_id;
  current_status := coalesce(current_status, 'active');

  insert into public.account_controls (user_id, status, reason, updated_at, updated_by)
  values (p_target_user_id, p_next_status, normalized_reason, now(), auth.uid())
  on conflict (user_id) do update set
    status = excluded.status,
    reason = excluded.reason,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  insert into public.account_admin_actions (target_user_id, actor_user_id, previous_status, next_status, reason)
  values (p_target_user_id, auth.uid(), current_status, p_next_status, normalized_reason);

  return jsonb_build_object('user_id', p_target_user_id, 'previous_status', current_status, 'status', p_next_status);
end;
$$;

revoke all on public.account_directory, public.account_controls, public.account_admin_actions from anon, authenticated;
alter table public.account_directory enable row level security;
alter table public.account_controls enable row level security;
alter table public.account_admin_actions enable row level security;
revoke all on function public.sync_endoacolhe_account_directory() from public, anon, authenticated;
revoke execute on function public.is_endoacolhe_account_active() from public, anon;
revoke execute on function public.list_endoacolhe_accounts(text, text) from public, anon;
revoke execute on function public.manage_endoacolhe_account(uuid, text, text) from public, anon;
grant execute on function public.is_endoacolhe_account_active() to authenticated;
grant execute on function public.list_endoacolhe_accounts(text, text) to authenticated;
grant execute on function public.manage_endoacolhe_account(uuid, text, text) to authenticated;

drop policy if exists "Pessoas autenticadas enviam somente seus próprios relatos" on public.community_stories;
create policy "Pessoas ativas enviam somente seus próprios relatos"
on public.community_stories for insert
to authenticated
with check ((select auth.uid()) = owner_id and consent_to_publish = true and status = 'pending' and (select public.is_endoacolhe_account_active()));

drop policy if exists "Pessoas criam somente suas conversas EndoBot" on public.endobot_conversations;
create policy "Pessoas ativas criam somente suas conversas EndoBot"
on public.endobot_conversations for insert
to authenticated
with check ((select auth.uid()) = owner_id and (select public.is_endoacolhe_account_active()));

drop policy if exists "Pessoas criam mensagens somente nas próprias conversas" on public.endobot_messages;
create policy "Pessoas ativas criam mensagens somente nas próprias conversas"
on public.endobot_messages for insert
to authenticated
with check (exists (select 1 from public.endobot_conversations conversation where conversation.id = conversation_id and conversation.owner_id = (select auth.uid())) and (select public.is_endoacolhe_account_active()));
