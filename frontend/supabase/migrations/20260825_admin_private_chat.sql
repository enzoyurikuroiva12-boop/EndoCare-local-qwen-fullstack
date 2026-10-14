-- Chat privado entre administradores com menções e atualização em tempo real.
-- O conteúdo só pode ser lido por pessoas com a permissão administrativa de suporte.

create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  mentioned_user_ids uuid[] not null default '{}'::uuid[] check (cardinality(mentioned_user_ids) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists admin_chat_messages_created_idx
  on public.admin_chat_messages(created_at asc);

alter table public.admin_chat_messages enable row level security;
revoke all on public.admin_chat_messages from anon, authenticated;
grant select on public.admin_chat_messages to authenticated;

drop policy if exists "Equipe autorizada lê chat administrativo" on public.admin_chat_messages;
create policy "Equipe autorizada lê chat administrativo"
on public.admin_chat_messages for select to authenticated
using ((select public.has_endoacolhe_permission('support_chat')));

create or replace function public.send_endoacolhe_admin_chat_message(
  p_body text,
  p_mentioned_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_body text;
  normalized_mentions uuid[];
  message_id uuid;
  message_created_at timestamptz;
begin
  if auth.uid() is null or not public.has_endoacolhe_permission('support_chat') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  normalized_body := btrim(coalesce(p_body, ''));
  if char_length(normalized_body) < 1 or char_length(normalized_body) > 1200 then
    raise exception 'message must contain between 1 and 1200 characters' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_mentioned_user_ids, '{}'::uuid[])) > 20 then
    raise exception 'too many mentions' using errcode = '22023';
  end if;

  select coalesce(array_agg(candidate.user_id order by candidate.user_id), '{}'::uuid[])
    into normalized_mentions
  from (
    select distinct mentioned_id as user_id
    from unnest(coalesce(p_mentioned_user_ids, '{}'::uuid[])) as mention(mentioned_id)
    where exists (select 1 from public.endoacolhe_owners owner where owner.user_id = mentioned_id)
       or exists (select 1 from public.admin_users staff where staff.user_id = mentioned_id)
  ) candidate;

  insert into public.admin_chat_messages(sender_id, body, mentioned_user_ids)
  values (auth.uid(), normalized_body, normalized_mentions)
  returning id, created_at into message_id, message_created_at;

  return jsonb_build_object(
    'id', message_id,
    'created_at', message_created_at,
    'mentioned_user_ids', normalized_mentions
  );
end;
$$;

revoke all on function public.send_endoacolhe_admin_chat_message(text, uuid[]) from public, anon;
grant execute on function public.send_endoacolhe_admin_chat_message(text, uuid[]) to authenticated;

create or replace function public.list_endoacolhe_admin_chat_members()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select directory.user_id, coalesce(nullif(btrim(directory.display_name), ''), 'Admin')
  from public.account_directory directory
  where public.has_endoacolhe_permission('support_chat')
    and (
      exists (select 1 from public.endoacolhe_owners owner where owner.user_id = directory.user_id)
      or exists (select 1 from public.admin_users staff where staff.user_id = directory.user_id)
    )
  order by lower(coalesce(directory.display_name, 'Admin')), directory.user_id;
$$;

revoke all on function public.list_endoacolhe_admin_chat_members() from public, anon;
grant execute on function public.list_endoacolhe_admin_chat_members() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_chat_messages'
  ) then
    alter publication supabase_realtime add table public.admin_chat_messages;
  end if;
end;
$$;
