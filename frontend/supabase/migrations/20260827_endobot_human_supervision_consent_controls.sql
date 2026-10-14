-- Controles de opt-in e revogação para a pessoa titular da conversa.
-- Revogar o consentimento encerra a leitura do Dono imediatamente e retoma a automação.

alter table public.endobot_human_supervision_audit
  drop constraint if exists endobot_human_supervision_audit_action_check,
  add constraint endobot_human_supervision_audit_action_check
    check (action in ('consent_granted', 'consent_revoked', 'paused', 'resumed', 'human_reply_sent'));

create or replace function public.audit_endoacolhe_endobot_human_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.human_review_consent then
    insert into public.endobot_human_supervision_audit(conversation_id, actor_user_id, action)
    values (new.id, coalesce(auth.uid(), new.owner_id), 'consent_granted');
  elsif tg_op = 'UPDATE' and old.human_review_consent is distinct from new.human_review_consent then
    insert into public.endobot_human_supervision_audit(conversation_id, actor_user_id, action)
    values (new.id, coalesce(auth.uid(), new.owner_id), case when new.human_review_consent then 'consent_granted' else 'consent_revoked' end);
  end if;
  return new;
end;
$$;

drop trigger if exists endobot_human_consent_audit on public.endobot_conversations;
create trigger endobot_human_consent_audit
after insert or update of human_review_consent on public.endobot_conversations
for each row execute function public.audit_endoacolhe_endobot_human_consent();

create or replace function public.set_endoacolhe_endobot_human_review_consent(p_conversation_id uuid, p_consent boolean)
returns table (
  id uuid,
  human_review_consent boolean,
  human_takeover_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_conversation_id is null or p_consent is null then
    raise exception 'an authenticated person, conversation and consent choice are required' using errcode = '22023';
  end if;

  update public.endobot_conversations conversation
  set human_review_consent = p_consent,
    human_review_consent_at = case when p_consent then now() else null end,
    human_review_consent_version = case when p_consent then '2026-08-27' else null end,
    human_takeover_status = case when p_consent then conversation.human_takeover_status else 'automated' end,
    human_takeover_at = case when p_consent then conversation.human_takeover_at else null end,
    human_taken_over_by = case when p_consent then conversation.human_taken_over_by else null end,
    updated_at = now()
  where conversation.id = p_conversation_id
    and conversation.owner_id = auth.uid()
  returning conversation.id, conversation.human_review_consent, conversation.human_takeover_status, conversation.updated_at
  into id, human_review_consent, human_takeover_status, updated_at;

  if id is null then
    raise exception 'conversation was not found for the current person' using errcode = 'P0002';
  end if;
  return next;
end;
$$;

revoke all on function public.set_endoacolhe_endobot_human_review_consent(uuid, boolean) from public, anon;
grant execute on function public.set_endoacolhe_endobot_human_review_consent(uuid, boolean) to authenticated;
