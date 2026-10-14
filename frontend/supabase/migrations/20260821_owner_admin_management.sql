-- Papel único de Dona e delegação administrativa exclusiva no EndoAcolhe.
create table if not exists public.endoacolhe_owners (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists endoacolhe_owners_singleton_idx on public.endoacolhe_owners ((true));

insert into public.endoacolhe_owners (user_id)
select directory.user_id
from public.account_directory directory
where lower(directory.email) = lower('enzoyurikuroiva@gmail.com')
on conflict do nothing;

insert into public.admin_users (user_id, created_by)
select owner.user_id, owner.user_id
from public.endoacolhe_owners owner
on conflict (user_id) do nothing;

create table if not exists public.admin_role_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('granted', 'revoked')),
  created_at timestamptz not null default now()
);

alter table public.endoacolhe_owners enable row level security;
alter table public.admin_role_actions enable row level security;
revoke all on public.endoacolhe_owners, public.admin_role_actions from anon, authenticated;

create or replace function public.is_endoacolhe_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.endoacolhe_owners owner where owner.user_id = auth.uid());
$$;

drop function if exists public.list_endoacolhe_accounts(text, text);
create function public.list_endoacolhe_accounts(p_search text default null, p_status text default 'all')
returns table (
  user_id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  status text,
  reason text,
  updated_at timestamptz,
  is_administrator boolean,
  expires_at timestamptz,
  is_owner boolean
)
language plpgsql
stable
security definer
set search_path = public
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
    case when control.expires_at is not null and control.expires_at <= now() then null else control.expires_at end,
    exists (select 1 from public.endoacolhe_owners owner where owner.user_id = directory.user_id)
  from public.account_directory directory
  left join public.account_controls control on control.user_id = directory.user_id
  where (p_status = 'all' or (case when control.expires_at is not null and control.expires_at <= now() then 'active' else coalesce(control.status, 'active') end) = p_status)
    and (p_search is null or p_search = '' or directory.display_name ilike '%' || p_search || '%' or directory.email ilike '%' || p_search || '%')
  order by directory.created_at desc
  limit 100;
end;
$$;

create or replace function public.manage_endoacolhe_administrator(p_target_user_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare target_is_owner boolean; target_is_admin boolean;
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can manage administrators' using errcode = '42501'; end if;
  if p_target_user_id is null then raise exception 'account not found' using errcode = 'P0002'; end if;
  if p_action not in ('grant', 'revoke') then raise exception 'invalid administrator action' using errcode = '22023'; end if;
  if not exists (select 1 from public.account_directory directory where directory.user_id = p_target_user_id) then raise exception 'account not found' using errcode = 'P0002'; end if;
  select exists (select 1 from public.endoacolhe_owners owner where owner.user_id = p_target_user_id), exists (select 1 from public.admin_users admin where admin.user_id = p_target_user_id)
  into target_is_owner, target_is_admin;
  if target_is_owner then raise exception 'the owner role cannot be changed from this panel' using errcode = '22023'; end if;
  if p_action = 'grant' and not target_is_admin then
    insert into public.admin_users (user_id, created_by) values (p_target_user_id, auth.uid());
    insert into public.admin_role_actions (actor_user_id, target_user_id, action) values (auth.uid(), p_target_user_id, 'granted');
  elsif p_action = 'revoke' and target_is_admin then
    delete from public.admin_users where user_id = p_target_user_id;
    insert into public.admin_role_actions (actor_user_id, target_user_id, action) values (auth.uid(), p_target_user_id, 'revoked');
  end if;
  return jsonb_build_object('user_id', p_target_user_id, 'is_administrator', p_action = 'grant');
end;
$$;

revoke all on function public.is_endoacolhe_owner() from public, anon;
revoke all on function public.manage_endoacolhe_administrator(uuid, text) from public, anon;
grant execute on function public.is_endoacolhe_owner() to authenticated;
grant execute on function public.list_endoacolhe_accounts(text, text) to authenticated;
grant execute on function public.manage_endoacolhe_administrator(uuid, text) to authenticated;
