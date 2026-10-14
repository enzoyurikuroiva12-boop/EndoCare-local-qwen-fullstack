-- Segunda etapa de acesso ao painel: a senha adicional é guardada somente como verificador SHA-512-crypt.
create table if not exists public.endoacolhe_admin_access_gate (
  singleton boolean primary key default true check (singleton),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

insert into public.endoacolhe_admin_access_gate (singleton, password_hash)
values (true, '$6$fhCEHfouJiE3_bAv$je6hsXgOM3Um9XQk3yRE2HrDcmBSm5o9az9fFatEKvsAuC7.j8SSINWvQ9WW9GsIk/eEMUNC0oERy/70DOhps.')
on conflict (singleton) do update set password_hash = excluded.password_hash, updated_at = now();

create table if not exists public.endoacolhe_admin_access_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.endoacolhe_admin_access_gate enable row level security;
alter table public.endoacolhe_admin_access_sessions enable row level security;
revoke all on public.endoacolhe_admin_access_gate, public.endoacolhe_admin_access_sessions from anon, authenticated;

create or replace function public.has_endoacolhe_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_endoacolhe_admin_role() is not null
    and exists (
      select 1
      from public.endoacolhe_admin_access_sessions session
      where session.user_id = auth.uid()
        and session.expires_at > now()
    );
$$;

create or replace function public.unlock_endoacolhe_admin_access(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_password_hash text;
begin
  if auth.uid() is null or public.current_endoacolhe_admin_role() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_password is null or char_length(p_password) < 1 or char_length(p_password) > 256 then
    return false;
  end if;

  select password_hash into stored_password_hash
  from public.endoacolhe_admin_access_gate
  where singleton = true;

  if stored_password_hash is null or extensions.crypt(p_password, stored_password_hash) <> stored_password_hash then
    return false;
  end if;

  insert into public.endoacolhe_admin_access_sessions (user_id, expires_at, updated_at)
  values (auth.uid(), now() + interval '12 hours', now())
  on conflict (user_id) do update
    set expires_at = excluded.expires_at,
        updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.is_endoacolhe_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_endoacolhe_admin_role() is not null
    and public.has_endoacolhe_admin_access();
$$;

revoke all on function public.has_endoacolhe_admin_access() from public;
revoke all on function public.unlock_endoacolhe_admin_access(text) from public;
revoke execute on function public.has_endoacolhe_admin_access() from anon;
revoke execute on function public.unlock_endoacolhe_admin_access(text) from anon;
grant execute on function public.has_endoacolhe_admin_access() to authenticated;
grant execute on function public.unlock_endoacolhe_admin_access(text) to authenticated;
