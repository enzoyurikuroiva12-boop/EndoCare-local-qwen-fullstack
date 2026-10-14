-- O Dono não recebe SELECT direto das tabelas de conversa/mensagem.
-- O Realtime do painel ocorre por um sinal administrativo sem conteúdo; a tela
-- recarrega os dados exclusivamente pelos RPCs que validam is_endoacolhe_owner().

drop policy if exists "Dono acessa conversas EndoBot consentidas" on public.endobot_conversations;
drop policy if exists "Dono acessa mensagens EndoBot consentidas" on public.endobot_messages;

create or replace function public.signal_endoacolhe_endobot_human_supervision_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_realtime_signal
  set updated_at = now()
  where singleton = true;
  return new;
end;
$$;

revoke all on function public.signal_endoacolhe_endobot_human_supervision_change() from public, anon, authenticated;

drop trigger if exists endobot_human_supervision_conversation_signal on public.endobot_conversations;
create trigger endobot_human_supervision_conversation_signal
after insert or update of human_review_consent, human_takeover_status on public.endobot_conversations
for each row execute function public.signal_endoacolhe_endobot_human_supervision_change();

drop trigger if exists endobot_human_supervision_message_signal on public.endobot_messages;
create trigger endobot_human_supervision_message_signal
after insert on public.endobot_messages
for each row execute function public.signal_endoacolhe_endobot_human_supervision_change();
