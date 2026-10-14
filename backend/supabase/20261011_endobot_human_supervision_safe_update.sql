-- Supabase safeupdate rejects UPDATE statements without WHERE, including those
-- executed by a conversation INSERT trigger. Scope the consented live signal
-- to its singleton row so authenticated history creation can complete.
begin;

create or replace function public.signal_endoacolhe_endobot_human_supervision_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_signal boolean := false;
begin
  if tg_table_name = 'endobot_conversations' then
    should_signal := case
      when tg_op = 'INSERT' then new.human_review_consent
      else coalesce(old.human_review_consent, false) or coalesce(new.human_review_consent, false)
    end;
  elsif tg_table_name = 'endobot_messages' then
    select conversation.human_review_consent into should_signal
    from public.endobot_conversations conversation
    where conversation.id = new.conversation_id;
    should_signal := coalesce(should_signal, false);
  end if;

  if should_signal then
    update public.admin_realtime_signal
    set updated_at = now()
    where singleton = true;
  end if;
  return new;
end;
$$;

revoke all on function public.signal_endoacolhe_endobot_human_supervision_change() from public, anon, authenticated;

commit;
