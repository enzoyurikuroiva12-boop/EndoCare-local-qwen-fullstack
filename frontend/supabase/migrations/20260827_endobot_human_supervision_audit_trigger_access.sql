-- A função de auditoria é chamada apenas pelo trigger; não deve estar exposta por RPC.
revoke all on function public.audit_endoacolhe_endobot_human_consent() from public, anon, authenticated;
