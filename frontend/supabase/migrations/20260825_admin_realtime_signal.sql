-- Sinal único e sem dados sensíveis para sincronizar o painel administrativo em tempo real.
create table if not exists public.admin_realtime_signal (
  singleton boolean primary key default true check (singleton = true),
  revision bigint not null default 0,
  source_table text not null default 'system',
  operation text not null default 'UPDATE',
  updated_at timestamptz not null default now()
);

insert into public.admin_realtime_signal (singleton, revision, source_table, operation)
values (true, 0, 'system', 'INSERT')
on conflict (singleton) do nothing;

alter table public.admin_realtime_signal enable row level security;
revoke all on public.admin_realtime_signal from anon, authenticated;
grant select on public.admin_realtime_signal to authenticated;

drop policy if exists "Administrative sessions read realtime signal" on public.admin_realtime_signal;
create policy "Administrative sessions read realtime signal"
  on public.admin_realtime_signal for select
  to authenticated
  using ((select public.has_endoacolhe_admin_access()));

create or replace function public.emit_endoacolhe_admin_realtime_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_realtime_signal
  set revision = revision + 1,
      source_table = tg_table_name,
      operation = tg_op,
      updated_at = now()
  where singleton = true;

  return null;
end;
$$;

revoke all on function public.emit_endoacolhe_admin_realtime_signal() from public, anon, authenticated;

do $$
declare target_table text;
begin
  foreach target_table in array array[
    'account_directory',
    'account_controls',
    'account_admin_actions',
    'admin_users',
    'admin_content_deletions',
    'admin_password_actions',
    'admin_role_actions',
    'community_stories',
    'blog_posts',
    'endobot_security_events',
    'endobot_ip_blocks',
    'account_support_threads',
    'account_support_messages',
    'endoacolhe_questionnaire_questions',
    'endoacolhe_questionnaire_responses',
    'site_monitoring_events'
  ] loop
    execute format('drop trigger if exists admin_realtime_signal_trigger on public.%I', target_table);
    execute format('create trigger admin_realtime_signal_trigger after insert or update or delete on public.%I for each statement execute function public.emit_endoacolhe_admin_realtime_signal()', target_table);
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_realtime_signal') then
    alter publication supabase_realtime add table public.admin_realtime_signal;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'endoacolhe_questionnaire_questions') then
    alter publication supabase_realtime add table public.endoacolhe_questionnaire_questions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'endoacolhe_questionnaire_responses') then
    alter publication supabase_realtime add table public.endoacolhe_questionnaire_responses;
  end if;
end;
$$;
