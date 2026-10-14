-- Controle global de manutenção: o público lê somente o estado; apenas o Dono altera.
create table if not exists public.endoacolhe_site_settings (
  singleton boolean primary key default true check (singleton),
  maintenance_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.endoacolhe_site_settings (singleton, maintenance_enabled)
values (true, true)
on conflict (singleton) do nothing;

alter table public.endoacolhe_site_settings enable row level security;
revoke all on public.endoacolhe_site_settings from anon, authenticated;

create or replace function public.get_endoacolhe_maintenance_status()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select maintenance_enabled from public.endoacolhe_site_settings where singleton = true), true);
$$;

create or replace function public.set_endoacolhe_maintenance(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_endoacolhe_owner() then
    raise exception 'only the owner can change maintenance mode' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'maintenance state is required' using errcode = '22023';
  end if;
  insert into public.endoacolhe_site_settings (singleton, maintenance_enabled, updated_at, updated_by)
  values (true, p_enabled, now(), auth.uid())
  on conflict (singleton) do update
    set maintenance_enabled = excluded.maintenance_enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  return p_enabled;
end;
$$;

revoke all on function public.get_endoacolhe_maintenance_status() from public;
revoke all on function public.set_endoacolhe_maintenance(boolean) from public;
grant execute on function public.get_endoacolhe_maintenance_status() to anon, authenticated;
grant execute on function public.set_endoacolhe_maintenance(boolean) to authenticated;
