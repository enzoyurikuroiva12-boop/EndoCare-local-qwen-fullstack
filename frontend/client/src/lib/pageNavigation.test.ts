import { describe, expect, it } from "vitest";
import { PAGE_EXIT_DURATION_MS, shouldAnimatePageTransition } from "./pageNavigation";

describe("page navigation motion", () => {
  it("keeps the route transition short and clear", () => {
    expect(PAGE_EXIT_DURATION_MS).toBe(240);
  });

  it("removes route movement when the person prefers reduced motion", () => {
    expect(shouldAnimatePageTransition(true)).toBe(false);
    expect(shouldAnimatePageTransition(false)).toBe(true);
  });
});
