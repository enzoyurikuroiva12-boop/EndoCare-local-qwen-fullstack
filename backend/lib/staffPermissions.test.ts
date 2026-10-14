import { describe, expect, it } from "vitest";
import { canDeleteAccounts, canResetPasswordDirectly } from "./staffPermissions.js";

describe("staff endpoint permissions", () => {
  it("reserves direct password replacement for the owner", () => {
    expect(canResetPasswordDirectly("owner")).toBe(true);
    expect(canResetPasswordDirectly("admin")).toBe(false);
    expect(canResetPasswordDirectly("moderator")).toBe(false);
    expect(canResetPasswordDirectly("support")).toBe(false);
  });

  it("allows account deletion only for owner and admin", () => {
    expect(canDeleteAccounts("owner")).toBe(true);
    expect(canDeleteAccounts("admin")).toBe(true);
    expect(canDeleteAccounts("moderator")).toBe(false);
    expect(canDeleteAccounts("support")).toBe(false);
  });
});
