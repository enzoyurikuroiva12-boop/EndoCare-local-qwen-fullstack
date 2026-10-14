import { describe, expect, it } from "vitest";
import { activeAccountControl, blocksRestrictedFeatures, blocksSiteAccess } from "./accountControl";

describe("account control states", () => {
  it("blocks the full site only for suspended accounts", () => {
    expect(blocksSiteAccess(activeAccountControl)).toBe(false);
    expect(blocksSiteAccess({ ...activeAccountControl, status: "restricted" })).toBe(false);
    expect(blocksSiteAccess({ ...activeAccountControl, status: "suspended" })).toBe(true);
  });

  it("blocks reports and EndoBot for restricted or suspended accounts", () => {
    expect(blocksRestrictedFeatures(activeAccountControl)).toBe(false);
    expect(blocksRestrictedFeatures({ ...activeAccountControl, status: "restricted" })).toBe(true);
    expect(blocksRestrictedFeatures({ ...activeAccountControl, status: "suspended" })).toBe(true);
  });
});
