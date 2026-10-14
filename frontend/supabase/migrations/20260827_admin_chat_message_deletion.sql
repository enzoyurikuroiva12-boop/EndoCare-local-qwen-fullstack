-- Exclusão auditável de mensagens do chat privado da equipe.
-- Administradores removem apenas as próprias mensagens; o Dono pode remover qualquer mensagem.

create table if not exists public.admin_chat_message_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  message_sender_id uuid not null,
  actor_user_id uuid not null,
  action text not null default 'deleted' check (action = 'deleted'),
  created_at timestamptz not null default now()
);

create index if not exists admin_chat_message_deletion_audit_created_idx
  on public.admin_chat_message_deletion_audit(created_at desc);

alter table public.admin_chat_message_deletion_audit enable row level security;
revoke all on public.admin_chat_message_deletion_audit from anon, authenticated;

revoke delete on public.admin_chat_messages from anon, authenticated;
drop policy if exists "Equipe autorizada apaga mensagens diretamente" on public.admin_chat_messages;

create or replace function public.delete_endoacolhe_admin_chat_message(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_sender_id uuid;
  deletion_created_at timestamptz;
begin
  if auth.uid() is null or not (
    public.has_endoacolhe_permission('support_chat')
    or public.is_endoacolhe_owner()
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_message_id is null then
    raise exception 'invalid message' using errcode = '22023';
  end if;

  select sender_id
    into target_sender_id
  from public.admin_chat_messages
  where id = p_message_id
  for update;

  if target_sender_id is null then
    raise exception 'message not found' using errcode = 'P0002';
  end if;

  if target_sender_id <> auth.uid() and not public.is_endoacolhe_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.admin_chat_message_deletion_audit (
    message_id,
    message_sender_id,
    actor_user_id
  ) values (
    p_message_id,
    target_sender_id,
    auth.uid()
  ) returning created_at into deletion_created_at;

  delete from public.admin_chat_messages where id = p_message_id;

  return jsonb_build_object(
    'id', p_message_id,
    'deleted_at', deletion_created_at
  );
end;
$$;

revoke all on function public.delete_endoacolhe_admin_chat_message(uuid) from public, anon;
grant execute on function public.delete_endoacolhe_admin_chat_message(uuid) to authenticated;
