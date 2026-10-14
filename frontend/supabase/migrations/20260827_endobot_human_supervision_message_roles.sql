-- Pessoas autenticadas não podem se passar pelo EndoBot nem pela equipe humana.
-- Respostas automáticas são gravadas pelo backend com service role e respostas humanas
-- somente pelo RPC security definer protegido por is_endoacolhe_owner().

drop policy if exists "Pessoas ativas criam mensagens somente nas próprias conversas" on public.endobot_messages;
create policy "Pessoas ativas enviam somente mensagens próprias ao EndoBot"
on public.endobot_messages for insert
to authenticated
with check (
  role = 'user'
  and exists (
    select 1 from public.endobot_conversations conversation
    where conversation.id = conversation_id and conversation.owner_id = (select auth.uid())
  )
  and (select public.is_endoacolhe_account_active())
);
