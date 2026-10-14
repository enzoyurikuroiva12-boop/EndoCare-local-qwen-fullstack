import { describe, expect, it } from "vitest";
import { canDeleteManagedAccount } from "./adminAccountAction.js";

describe("admin account deletion safeguards", () => {
  it("rejects missing, self and administrator targets", () => {
    expect(canDeleteManagedAccount("admin", "", false)).toBe(false);
    expect(canDeleteManagedAccount("admin", "admin", false)).toBe(false);
    expect(canDeleteManagedAccount("admin", "other-admin", true)).toBe(false);
  });

  it("allows an administrator to delete only a different common account", () => {
    expect(canDeleteManagedAccount("admin", "person", false)).toBe(true);
  });
});
