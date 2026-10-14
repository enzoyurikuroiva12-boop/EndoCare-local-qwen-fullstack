import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260828_report_triage.sql"), "utf8");

 describe("migração de triagem de relatos", () => {
  it("mantém publicação e triagem em campos separados", () => {
    expect(migration).toContain("triage_status");
    expect(migration).toContain("triage_confidence");
    expect(migration).toContain("triage_signals");
    expect(migration).toContain("triage_checked_at");
    expect(migration).toContain("triage_status in ('adequate', 'needs_review', 'likely_spam')");
  });

  it("documenta que o resultado não publica nem rejeita o relato", () => {
    expect(migration).toContain("não publica nem rejeita o relato");
    expect(migration).not.toContain("triage_prompt");
    expect(migration).not.toContain("raw_response");
  });
});
