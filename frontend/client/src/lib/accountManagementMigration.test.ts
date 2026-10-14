import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260820_account_management.sql"), "utf8");
const notificationsMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260821_account_controls_notifications.sql"), "utf8");
const ownerMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260821_owner_admin_management.sql"), "utf8");
const storyDeletionMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260821_story_deletion_notification_status.sql"), "utf8");
const realtimeSupportMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_realtime_support.sql"), "utf8");
const requiredExpiryMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_require_punishment_expiry.sql"), "utf8");
const adminAccessGateMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_admin_access_gate.sql"), "utf8");
const adminAccessGateRepairMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_admin_access_gate_password_repair.sql"), "utf8");
const reputationResetMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260822_owner_reputation_reset.sql"), "utf8");

describe("account management migration safeguards", () => {
  it("uses protected RPCs and keeps the account tables closed to direct frontend access", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("revoke all on public.account_directory, public.account_controls, public.account_admin_actions from anon, authenticated");
    expect(migration).toContain("grant execute on function public.manage_endoacolhe_account(uuid, text, text) to authenticated");
  });

  it("prevents self-management and in-panel changes to administrator accounts while writing an audit record", () => {
    expect(migration).toContain("p_target_user_id = auth.uid()");
    expect(migration).toContain("from public.admin_users where user_id = p_target_user_id");
    expect(migration).toContain("insert into public.account_admin_actions");
  });

  it("requires a reason for restrictive statuses and blocks new protected activity for inactive accounts", () => {
    expect(migration).toContain("a reason between 3 and 300 characters is required");
    expect(migration).toContain("Pessoas ativas enviam somente seus próprios relatos");
    expect(migration).toContain("Pessoas ativas criam somente suas conversas EndoBot");
  });

  it("models temporary account controls and private notifications without opening account data publicly", () => {
    expect(notificationsMigration).toContain("expires_at timestamptz");
    expect(notificationsMigration).toContain("current_endoacolhe_account_control");
    expect(notificationsMigration).toContain("account_notifications");
    expect(notificationsMigration).toContain("Pessoas leem somente as próprias notificações");
    expect(notificationsMigration).toContain("expiry must be in the future");
  });

  it("defines a single owner and reserves administrator role changes for that account", () => {
    expect(ownerMigration).toContain("endoacolhe_owners_singleton_idx");
    expect(ownerMigration).toContain("enzoyurikuroiva@gmail.com");
    expect(ownerMigration).toContain("only the owner can manage administrators");
    expect(ownerMigration).toContain("the owner role cannot be changed from this panel");
    expect(ownerMigration).toContain("admin_role_actions");
  });

  it("notifies deletion only for approved or pending stories, preserving rejected-story context", () => {
    expect(storyDeletionMigration).toContain("previous_story_status");
    expect(storyDeletionMigration).toContain("previous_story_status = 'approved'");
    expect(storyDeletionMigration).toContain("previous_story_status = 'pending'");
    expect(storyDeletionMigration).not.toContain("previous_story_status = 'rejected'");
  });

  it("keeps support conversations private while publishing only the necessary live events", () => {
    expect(realtimeSupportMigration).toContain("account_support_threads");
    expect(realtimeSupportMigration).toContain("account_support_messages");
    expect(realtimeSupportMigration).toContain("open_endoacolhe_account_support");
    expect(realtimeSupportMigration).toContain("support is available only for restricted or suspended accounts");
    expect(realtimeSupportMigration).toContain("alter publication supabase_realtime add table public.account_controls");
    expect(realtimeSupportMigration).toContain("alter publication supabase_realtime add table public.account_support_threads");
    expect(realtimeSupportMigration).toContain("alter publication supabase_realtime add table public.account_support_messages");
    expect(realtimeSupportMigration).toContain("Solicitante ou administração enviam mensagens de atendimento");
  });

  it("requires a future expiry for every new restrictive measure", () => {
    expect(requiredExpiryMigration).toContain("p_expires_at is null or p_expires_at <= now()");
    expect(requiredExpiryMigration).toContain("a future expiry is required");
  });

  it("stores only a cryptographic verifier for the additional admin password and expires its session", () => {
    expect(adminAccessGateMigration).toContain("password_hash text not null");
    expect(adminAccessGateMigration).toContain("extensions.crypt(p_password, stored_password_hash)");
    expect(adminAccessGateMigration).toContain("interval '12 hours'");
    expect(adminAccessGateMigration).toContain("public.has_endoacolhe_admin_access()");
    expect(adminAccessGateMigration).toContain("revoke all on public.endoacolhe_admin_access_gate, public.endoacolhe_admin_access_sessions from anon, authenticated");
    expect(adminAccessGateMigration).toContain("revoke execute on function public.unlock_endoacolhe_admin_access(text) from anon");
  });

  it("repairs the initial verifier with a bcrypt value compatible with the database crypt function", () => {
    expect(adminAccessGateRepairMigration).toContain("$2a$12$");
    expect(adminAccessGateRepairMigration).toContain("on conflict (singleton) do update");
    expect(adminAccessGateRepairMigration).not.toContain("ADMINROOTSESI");
  });

  it("reserves reputation restoration for the owner while leaving active account controls intact", () => {
    expect(reputationResetMigration).toContain("if not public.is_endoacolhe_owner()");
    expect(reputationResetMigration).toContain("delete from public.account_admin_actions");
    expect(reputationResetMigration).not.toContain("delete from public.account_controls");
    expect(reputationResetMigration).toContain("staff accounts cannot have punishment history reset from this panel");
    expect(reputationResetMigration).toContain("grant execute on function public.reset_endoacolhe_account_reputation(uuid) to authenticated");
  });
});
