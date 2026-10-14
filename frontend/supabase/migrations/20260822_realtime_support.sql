-- Atualizações em tempo real e canal privado de suporte para contas restritas ou suspensas.

create policy "Pessoas e administradores leem controles para atualização em tempo real"
on public.account_controls for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_endoacolhe_admin()));

grant select on public.account_controls to authenticated;

create table if not exists public.account_support_threads (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_support_one_open_thread_per_requester
  on public.account_support_threads(requester_id)
  where status = 'open';
create index if not exists account_support_threads_updated_idx
  on public.account_support_threads(updated_at desc);

create table if not exists public.account_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.account_support_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);
create index if not exists account_support_messages_thread_created_idx
  on public.account_support_messages(thread_id, created_at asc);

alter table public.account_support_threads enable row level security;
alter table public.account_support_messages enable row level security;
revoke all on public.account_support_threads, public.account_support_messages from anon;
grant select on public.account_support_threads, public.account_support_messages to authenticated;
grant insert on public.account_support_messages to authenticated;
grant update(status) on public.account_support_threads to authenticated;

create policy "Solicitantes e administradores leem atendimentos de conta"
on public.account_support_threads for select to authenticated
using ((select auth.uid()) = requester_id or (select public.is_endoacolhe_admin()));

create policy "Somente administradores encerram atendimentos de conta"
on public.account_support_threads for update to authenticated
using ((select public.is_endoacolhe_admin()))
with check ((select public.is_endoacolhe_admin()));

create policy "Participantes leem mensagens de atendimento"
on public.account_support_messages for select to authenticated
using (exists (
  select 1 from public.account_support_threads thread
  where thread.id = thread_id
    and (thread.requester_id = (select auth.uid()) or (select public.is_endoacolhe_admin()))
));

create policy "Solicitante ou administração enviam mensagens de atendimento"
on public.account_support_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.account_support_threads thread
    where thread.id = thread_id
      and thread.status = 'open'
      and (thread.requester_id = (select auth.uid()) or (select public.is_endoacolhe_admin()))
  )
);

create or replace function public.open_endoacolhe_account_support()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  thread_id uuid;
  account_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  account_status := public.current_endoacolhe_account_control() ->> 'status';
  if account_status not in ('restricted', 'suspended') then
    raise exception 'support is available only for restricted or suspended accounts' using errcode = '42501';
  end if;
  select id into thread_id from public.account_support_threads
  where requester_id = auth.uid() and status = 'open'
  order by updated_at desc limit 1;
  if thread_id is null then
    insert into public.account_support_threads(requester_id) values (auth.uid()) returning id into thread_id;
  end if;
  return thread_id;
end;
$$;

create or replace function public.touch_endoacolhe_support_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.account_support_threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists touch_endoacolhe_support_thread on public.account_support_messages;
create trigger touch_endoacolhe_support_thread
after insert on public.account_support_messages
for each row execute function public.touch_endoacolhe_support_thread();

revoke all on function public.open_endoacolhe_account_support() from public, anon;
grant execute on function public.open_endoacolhe_account_support() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_controls') then alter publication supabase_realtime add table public.account_controls; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_notifications') then alter publication supabase_realtime add table public.account_notifications; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_stories') then alter publication supabase_realtime add table public.community_stories; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_support_threads') then alter publication supabase_realtime add table public.account_support_threads; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'account_support_messages') then alter publication supabase_realtime add table public.account_support_messages; end if;
end;
$$;
