import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260827_endobot_human_supervision.sql"), "utf8");

describe("EndoBot human supervision migration safeguards", () => {
  it("requires a per-conversation consent and preserves a reversible takeover state", () => {
    expect(migration).toContain("human_review_consent boolean not null default false");
    expect(migration).toContain("human_takeover_status text not null default 'automated'");
    expect(migration).toContain("check (human_takeover_status in ('automated', 'paused'))");
    expect(migration).toContain("human_review_consent = true and human_review_consent_at is not null");
  });

  it("uses owner-checked RPCs instead of granting a broad audit table read", () => {
    expect(migration).toContain("if not public.is_endoacolhe_owner()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("revoke all on public.endobot_human_supervision_audit from anon, authenticated");
    expect(migration).toContain("grant execute on function public.add_endoacolhe_human_supervision_reply(uuid, text) to authenticated");
  });

  it("audits operational actions without recording response content in the audit table", () => {
    expect(migration).toContain("action in ('paused', 'resumed', 'human_reply_sent')");
    expect(migration).toContain("insert into public.endobot_human_supervision_audit");
    expect(migration).not.toContain("audit_content");
  });

  it("allows realtime only for the conversation and message streams necessary to update the consented workspace", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.endobot_conversations");
    expect(migration).toContain("alter publication supabase_realtime add table public.endobot_messages");
    expect(migration).not.toContain("alter publication supabase_realtime add table public.endobot_human_supervision_audit");
  });

  it("keeps the Owner off direct message reads and sends only a content-free administrative live signal", () => {
    const privateRealtimeMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260827_endobot_human_supervision_private_realtime.sql"), "utf8");
    expect(privateRealtimeMigration).toContain('drop policy if exists "Dono acessa mensagens EndoBot consentidas"');
    expect(privateRealtimeMigration).toContain("admin_realtime_signal");
    expect(privateRealtimeMigration).not.toContain("content text");
    const consentFilterMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260827_endobot_human_supervision_signal_consent_filter.sql"), "utf8");
    expect(consentFilterMigration).toContain("new.human_review_consent");
    expect(consentFilterMigration).toContain("conversation.human_review_consent");
  });

  it("repairs authenticated history inserts without weakening consent or exposing the trigger as an RPC", () => {
    const safeUpdateMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261011_endobot_human_supervision_safe_update.sql"), "utf8");
    expect(safeUpdateMigration).toMatch(/update\s+public\.admin_realtime_signal\s+set\s+updated_at\s*=\s*now\(\)\s+where\s+singleton\s*=\s*true\s*;/i);
    expect(safeUpdateMigration).toContain("if should_signal then");
    expect(safeUpdateMigration).toContain("new.human_review_consent");
    expect(safeUpdateMigration).toContain("conversation.human_review_consent");
    expect(safeUpdateMigration).toContain("security definer");
    expect(safeUpdateMigration).toContain("revoke all on function public.signal_endoacolhe_endobot_human_supervision_change() from public, anon, authenticated");
    expect(safeUpdateMigration).not.toMatch(/disable\s+row\s+level\s+security/i);
    expect(safeUpdateMigration).not.toMatch(/grant\s+.*(?:endobot_conversations|endobot_messages)/i);
  });
});
