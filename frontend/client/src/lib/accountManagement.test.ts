import { describe, expect, it } from "vitest";
import { accountActionsFor, canManageAccount, canManageAdministratorRole, canResetPunishmentReputation, needsAccountReason, punishmentReputation, staffCan, type ManagedAccount } from "./accountManagement";

const account = (overrides: Partial<ManagedAccount> = {}): ManagedAccount => ({
  user_id: "account-a",
  display_name: "Pessoa",
  email: "pessoa@example.com",
  created_at: "2026-08-20T00:00:00.000Z",
  status: "active",
  reason: null,
  updated_at: null,
  is_administrator: false,
  expires_at: null,
  is_owner: false,
  admin_role: null,
  punishment_count: 0,
  ...overrides,
});

describe("account management safeguards", () => {
  it("requires a reason only for restrictive actions", () => {
    expect(needsAccountReason("active")).toBe(false);
    expect(needsAccountReason("restricted")).toBe(true);
    expect(needsAccountReason("suspended")).toBe(true);
  });

  it("offers restoration instead of destructive account removal", () => {
    expect(accountActionsFor("active")).toEqual(["restricted", "suspended"]);
    expect(accountActionsFor("restricted")).toEqual(["active"]);
    expect(accountActionsFor("suspended")).toEqual(["active"]);
  });

  it("blocks the current administrator and other administrators from in-panel account actions", () => {
    expect(canManageAccount(account({ user_id: "admin-a" }), "admin-a")).toBe(false);
    expect(canManageAccount(account({ is_administrator: true }), "admin-a")).toBe(false);
    expect(canManageAccount(account(), "admin-a")).toBe(true);
  });

  it("keeps the owner protected and reserves administrator roles for the owner", () => {
    expect(canManageAccount(account({ is_owner: true }), "admin-a")).toBe(false);
    expect(canManageAdministratorRole(account({ user_id: "owner-a", is_owner: true }), "owner-a", true)).toBe(false);
    expect(canManageAdministratorRole(account({ is_administrator: true }), "owner-a", false)).toBe(false);
    expect(canManageAdministratorRole(account({ is_administrator: true }), "owner-a", true)).toBe(true);
  });

  it("reserves punishment-history restoration for the owner and only for affected common accounts", () => {
    expect(canResetPunishmentReputation(account({ punishment_count: 1 }), "owner-a", true)).toBe(true);
    expect(canResetPunishmentReputation(account({ punishment_count: 0 }), "owner-a", true)).toBe(false);
    expect(canResetPunishmentReputation(account({ punishment_count: 2 }), "admin-a", false)).toBe(false);
    expect(canResetPunishmentReputation(account({ punishment_count: 2, is_administrator: true }), "owner-a", true)).toBe(false);
    expect(canResetPunishmentReputation(account({ punishment_count: 2, is_owner: true }), "owner-a", true)).toBe(false);
    expect(canResetPunishmentReputation(account({ user_id: "owner-a", punishment_count: 2 }), "owner-a", true)).toBe(false);
  });

  it("separates support, moderator, admin and owner permissions", () => {
    expect(staffCan("support", "supportChat")).toBe(true);
    expect(staffCan("support", "applyPunishments")).toBe(false);
    expect(staffCan("moderator", "moderateStories")).toBe(true);
    expect(staffCan("moderator", "manageBlog")).toBe(false);
    expect(staffCan("admin", "sendPasswordReset")).toBe(true);
    expect(staffCan("admin", "resetPasswordDirectly")).toBe(false);
    expect(staffCan("owner", "manageRoles")).toBe(true);
  });

  it("allows questionnaire management and results only for admin-level roles", () => {
    expect(staffCan("admin", "manageQuestionnaire")).toBe(true);
    expect(staffCan("admin", "viewQuestionnaireResults")).toBe(true);
    expect(staffCan("owner", "manageQuestionnaire")).toBe(true);
    expect(staffCan("owner", "viewQuestionnaireResults")).toBe(true);
    expect(staffCan("moderator", "manageQuestionnaire")).toBe(false);
    expect(staffCan("moderator", "viewQuestionnaireResults")).toBe(false);
    expect(staffCan("support", "manageQuestionnaire")).toBe(false);
    expect(staffCan("support", "viewQuestionnaireResults")).toBe(false);
  });

  it("derives a readable punishment reputation without using user-generated data", () => {
    expect(punishmentReputation(0)).toBe("good");
    expect(punishmentReputation(2)).toBe("attention");
    expect(punishmentReputation(3)).toBe("very-poor");
  });
});
