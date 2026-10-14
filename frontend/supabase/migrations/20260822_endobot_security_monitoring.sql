-- Eventos de segurança do EndoBot: sem armazenar texto de chat ou IP em claro.
create table if not exists public.endobot_security_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  ip_fingerprint text not null check (char_length(ip_fingerprint) = 64),
  question_fingerprint text not null check (char_length(question_fingerprint) = 64),
  signals text[] not null check (cardinality(signals) > 0),
  action text not null check (action in ('blocked', 'ip_blocked', 'suspended')),
  expires_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index if not exists endobot_security_events_ip_created_idx on public.endobot_security_events (ip_fingerprint, created_at desc);
create index if not exists endobot_security_events_user_created_idx on public.endobot_security_events (user_id, created_at desc) where user_id is not null;

create table if not exists public.endobot_ip_blocks (
  ip_fingerprint text primary key check (char_length(ip_fingerprint) = 64),
  reason text not null check (char_length(reason) between 3 and 300),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.endobot_security_events enable row level security;
alter table public.endobot_ip_blocks enable row level security;
revoke all on public.endobot_security_events, public.endobot_ip_blocks from anon, authenticated;

create or replace function public.list_endoacolhe_endobot_security_events()
returns table (
  id uuid, created_at timestamptz, user_name text, user_email text, ip_fingerprint text, signals text[], action text, expires_at timestamptz, reviewed_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can view EndoBot security events' using errcode = '42501'; end if;
  return query
  select event.id, event.created_at, directory.display_name, directory.email, event.ip_fingerprint, event.signals, event.action, event.expires_at, event.reviewed_at
  from public.endobot_security_events event
  left join public.account_directory directory on directory.user_id = event.user_id
  order by event.created_at desc limit 200;
end;
$$;

create or replace function public.review_endoacolhe_endobot_security_event(p_event_id uuid, p_clear_ip_block boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_fingerprint text;
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can review EndoBot security events' using errcode = '42501'; end if;
  select ip_fingerprint into target_fingerprint from public.endobot_security_events where id = p_event_id for update;
  if target_fingerprint is null then raise exception 'security event not found' using errcode = 'P0002'; end if;
  update public.endobot_security_events set reviewed_at = now(), reviewed_by = auth.uid() where id = p_event_id;
  if p_clear_ip_block then delete from public.endobot_ip_blocks where ip_fingerprint = target_fingerprint; end if;
  return jsonb_build_object('event_id', p_event_id, 'ip_block_cleared', p_clear_ip_block);
end;
$$;

revoke all on function public.list_endoacolhe_endobot_security_events() from public, anon;
revoke all on function public.review_endoacolhe_endobot_security_event(uuid, boolean) from public, anon;
grant execute on function public.list_endoacolhe_endobot_security_events() to authenticated;
grant execute on function public.review_endoacolhe_endobot_security_event(uuid, boolean) to authenticated;
