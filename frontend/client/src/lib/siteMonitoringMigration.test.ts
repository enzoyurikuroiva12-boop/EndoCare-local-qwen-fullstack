import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_site_monitoring.sql"), "utf8");
const dedupeMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_site_monitoring_dedupe.sql"), "utf8");
const adminRealtimeMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260825_admin_realtime_signal.sql"), "utf8");

describe("migração de monitoramento do site", () => {
  it("mantém somente eventos mínimos, com retenção delimitada", () => {
    expect(migration).toContain("event_type in ('page_view', 'engaged_15s', 'scroll_50', 'scroll_90', 'runtime_error', 'admin_open')");
    expect(migration).toContain("now() - interval '90 days'");
    expect(migration).not.toContain("ip_address");
    expect(migration).not.toContain("message_body");
  });

  it("fecha a tabela para leitura direta e limita as métricas agregadas ao Dono", () => {
    expect(migration).toContain("revoke all on public.site_monitoring_events from anon, authenticated");
    expect(migration).toContain("only the owner can view site monitoring");
    expect(migration).toContain("grant execute on function public.list_endoacolhe_site_monitoring(integer) to authenticated");
  });

  it("deduplica a telemetria por sessão e remove o painel administrativo da audiência pública", () => {
    expect(dedupeMigration).toContain("route_path = '/admin' or event_type = 'admin_open'");
    expect(dedupeMigration).toContain("site_monitoring_events_unique_session_event_idx");
    expect(dedupeMigration).toContain("partition by event_type, route_path, session_id");
    expect(dedupeMigration).toContain("'admin_actions'");
  });

  it("cria um sinal realtime protegido sem expor dados das tabelas administrativas", () => {
    expect(adminRealtimeMigration).toContain("create table if not exists public.admin_realtime_signal");
    expect(adminRealtimeMigration).toContain("has_endoacolhe_admin_access");
    expect(adminRealtimeMigration).toContain("for each statement");
    expect(adminRealtimeMigration).toContain("alter publication supabase_realtime add table public.admin_realtime_signal");
    expect(adminRealtimeMigration).toContain("endoacolhe_questionnaire_questions");
  });
});
