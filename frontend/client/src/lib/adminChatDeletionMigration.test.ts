import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migração de exclusão do chat administrativo", () => {
  const source = readFileSync(resolve(process.cwd(), "supabase/migrations/20260827_admin_chat_message_deletion.sql"), "utf8");

  it("mantém a exclusão atrás de RPC e audita sem copiar o corpo da mensagem", () => {
    expect(source).toContain("admin_chat_message_deletion_audit");
    expect(source).not.toContain("body text");
    expect(source).toContain("delete_endoacolhe_admin_chat_message");
    expect(source).toContain("revoke delete on public.admin_chat_messages from anon, authenticated");
  });

  it("limita mensagens de terceiros ao Dono", () => {
    expect(source).toContain("target_sender_id <> auth.uid() and not public.is_endoacolhe_owner()");
    expect(source).toContain("has_endoacolhe_permission('support_chat')");
    expect(source).toContain("grant execute on function public.delete_endoacolhe_admin_chat_message(uuid) to authenticated");
  });
});
