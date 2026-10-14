-- Classificação defensiva dos eventos do EndoBot sem armazenar texto original ou IP em claro.
alter table public.endobot_security_events
  add column if not exists category text not null default 'prompt_injection' check (category in ('credential_access', 'prompt_injection', 'fault_injection', 'data_exfiltration', 'destructive_request', 'sensitive_disclosure')),
  add column if not exists severity text not null default 'medium' check (severity in ('medium', 'high', 'critical')),
  add column if not exists risk_score smallint not null default 3 check (risk_score between 1 and 5),
  add column if not exists source text not null default 'input' check (source in ('input', 'output'));

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
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_endoacolhe_owner() then raise exception 'only the owner can view EndoBot security events' using errcode = '42501'; end if;
  return query
  select event.id, event.created_at, directory.display_name, directory.email, event.ip_fingerprint, event.signals, event.category, event.severity, event.risk_score, event.source, event.action, event.expires_at, event.reviewed_at
  from public.endobot_security_events event
  left join public.account_directory directory on directory.user_id = event.user_id
  order by event.created_at desc limit 200;
end;
$$;

revoke all on function public.list_endoacolhe_endobot_security_events() from public, anon;
grant execute on function public.list_endoacolhe_endobot_security_events() to authenticated;
