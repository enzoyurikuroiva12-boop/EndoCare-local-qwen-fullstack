import { describe, expect, it } from "vitest";
import { revealObserverOptions } from "./MotionSystem";

describe("mobile reveal observer options", () => {
  it("reveals content early enough on narrow screens to avoid delayed motion", () => {
    expect(revealObserverOptions(true)).toEqual({ rootMargin: "0px 0px -6%", threshold: 0.06 });
  });

  it("keeps the wider viewport configuration more immediate", () => {
    expect(revealObserverOptions(false)).toEqual({ rootMargin: "0px 0px -2%", threshold: 0.02 });
  });
});
