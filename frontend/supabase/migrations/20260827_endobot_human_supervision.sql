-- Supervisão humana consentida do EndoBot.
-- O conteúdo de conversas continua privado por padrão e só pode ser consultado
-- pela pessoa titular ou, quando houver consentimento explícito, pelo Dono.

alter table public.endobot_conversations
  add column if not exists human_review_consent boolean not null default false,
  add column if not exists human_review_consent_at timestamptz,
  add column if not exists human_review_consent_version text,
  add column if not exists human_takeover_status text not null default 'automated',
  add column if not exists human_takeover_at timestamptz,
  add column if not exists human_taken_over_by uuid references auth.users(id) on delete set null;

alter table public.endobot_conversations
  drop constraint if exists endobot_conversations_human_takeover_status_check,
  add constraint endobot_conversations_human_takeover_status_check
    check (human_takeover_status in ('automated', 'paused')),
  drop constraint if exists endobot_conversations_human_review_consent_check,
  add constraint endobot_conversations_human_review_consent_check
    check (
      (human_review_consent = false and human_review_consent_at is null and human_review_consent_version is null)
      or
      (human_review_consent = true and human_review_consent_at is not null and char_length(coalesce(human_review_consent_version, '')) between 1 and 40)
    );

alter table public.endobot_messages
  drop constraint if exists endobot_messages_role_check,
  add constraint endobot_messages_role_check check (role in ('user', 'assistant', 'human'));

create table if not exists public.endobot_human_supervision_audit (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.endobot_conversations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('paused', 'resumed', 'human_reply_sent')),
  created_at timestamptz not null default now()
);

create index if not exists endobot_conversations_human_supervision_idx
  on public.endobot_conversations(updated_at desc)
  where human_review_consent = true;
create index if not exists endobot_human_supervision_audit_conversation_created_idx
  on public.endobot_human_supervision_audit(conversation_id, created_at desc);

alter table public.endobot_human_supervision_audit enable row level security;
revoke all on public.endobot_human_supervision_audit from anon, authenticated;

drop policy if exists "Dono acessa conversas EndoBot consentidas" on public.endobot_conversations;
create policy "Dono acessa conversas EndoBot consentidas"
on public.endobot_conversations for select
to authenticated
using (human_review_consent = true and public.is_endoacolhe_owner());

drop policy if exists "Dono acessa mensagens EndoBot consentidas" on public.endobot_messages;
create policy "Dono acessa mensagens EndoBot consentidas"
on public.endobot_messages for select
to authenticated
using (
  public.is_endoacolhe_owner()
  and exists (
    select 1 from public.endobot_conversations conversation
    where conversation.id = endobot_messages.conversation_id
      and conversation.human_review_consent = true
  )
);

create or replace function public.list_endoacolhe_human_supervision_conversations(p_limit integer default 40)
returns table (
  id uuid,
  category text,
  language text,
  title text,
  updated_at timestamptz,
  human_takeover_status text,
  human_takeover_at timestamptz,
  message_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can view human-supervised EndoBot conversations' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 80 then
    raise exception 'limit must be between 1 and 80' using errcode = '22023';
  end if;

  return query
  select conversation.id,
    conversation.category,
    conversation.language,
    conversation.title,
    conversation.updated_at,
    conversation.human_takeover_status,
    conversation.human_takeover_at,
    count(message.id) as message_count
  from public.endobot_conversations conversation
  left join public.endobot_messages message on message.conversation_id = conversation.id
  where conversation.human_review_consent = true
  group by conversation.id
  order by conversation.updated_at desc
  limit p_limit;
end;
$$;

create or replace function public.list_endoacolhe_human_supervision_messages(p_conversation_id uuid)
returns table (
  id uuid,
  role text,
  content text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can view human-supervised EndoBot messages' using errcode = '42501';
  end if;
  if p_conversation_id is null or not exists (
    select 1 from public.endobot_conversations
    where id = p_conversation_id and human_review_consent = true
  ) then
    raise exception 'conversation is not available for supervision' using errcode = 'P0002';
  end if;

  return query
  select message.id, message.role, message.content, message.created_at
  from public.endobot_messages message
  where message.conversation_id = p_conversation_id
  order by message.created_at asc
  limit 100;
end;
$$;

create or replace function public.set_endoacolhe_human_supervision_pause(p_conversation_id uuid, p_paused boolean)
returns table (
  id uuid,
  human_takeover_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text := case when coalesce(p_paused, false) then 'paused' else 'automated' end;
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can pause EndoBot conversations' using errcode = '42501';
  end if;
  if p_conversation_id is null then
    raise exception 'conversation is required' using errcode = '22023';
  end if;

  update public.endobot_conversations conversation
  set human_takeover_status = next_status,
    human_takeover_at = case when next_status = 'paused' then now() else null end,
    human_taken_over_by = case when next_status = 'paused' then auth.uid() else null end,
    updated_at = now()
  where conversation.id = p_conversation_id
    and conversation.human_review_consent = true
  returning conversation.id, conversation.human_takeover_status, conversation.updated_at
  into id, human_takeover_status, updated_at;

  if id is null then
    raise exception 'conversation is not available for supervision' using errcode = 'P0002';
  end if;

  insert into public.endobot_human_supervision_audit(conversation_id, actor_user_id, action)
  values (p_conversation_id, auth.uid(), case when next_status = 'paused' then 'paused' else 'resumed' end);

  return next;
end;
$$;

create or replace function public.add_endoacolhe_human_supervision_reply(p_conversation_id uuid, p_content text)
returns table (
  id uuid,
  role text,
  content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_content text := nullif(btrim(coalesce(p_content, '')), '');
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can respond as the human team' using errcode = '42501';
  end if;
  if p_conversation_id is null or normalized_content is null or char_length(normalized_content) > 2400 then
    raise exception 'a response between 1 and 2400 characters is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.endobot_conversations
    where id = p_conversation_id
      and human_review_consent = true
      and human_takeover_status = 'paused'
  ) then
    raise exception 'pause this consented conversation before sending a human reply' using errcode = 'P0002';
  end if;

  insert into public.endobot_messages(conversation_id, role, content)
  values (p_conversation_id, 'human', normalized_content)
  returning endobot_messages.id, endobot_messages.role, endobot_messages.content, endobot_messages.created_at
  into id, role, content, created_at;

  update public.endobot_conversations
  set updated_at = now()
  where endobot_conversations.id = p_conversation_id;

  insert into public.endobot_human_supervision_audit(conversation_id, actor_user_id, action)
  values (p_conversation_id, auth.uid(), 'human_reply_sent');

  return next;
end;
$$;

revoke all on function public.list_endoacolhe_human_supervision_conversations(integer) from public, anon;
revoke all on function public.list_endoacolhe_human_supervision_messages(uuid) from public, anon;
revoke all on function public.set_endoacolhe_human_supervision_pause(uuid, boolean) from public, anon;
revoke all on function public.add_endoacolhe_human_supervision_reply(uuid, text) from public, anon;
grant execute on function public.list_endoacolhe_human_supervision_conversations(integer) to authenticated;
grant execute on function public.list_endoacolhe_human_supervision_messages(uuid) to authenticated;
grant execute on function public.set_endoacolhe_human_supervision_pause(uuid, boolean) to authenticated;
grant execute on function public.add_endoacolhe_human_supervision_reply(uuid, text) to authenticated;

alter table public.endobot_conversations replica identity full;
alter table public.endobot_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'endobot_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.endobot_conversations';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'endobot_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.endobot_messages';
  end if;
end;
$$;
