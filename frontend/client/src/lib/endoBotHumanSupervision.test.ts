import { describe, expect, it } from "vitest";
import { HUMAN_SUPERVISION_REPLY_LIMIT, isHumanSupervisionReplyValid, nextHumanTakeoverStatus, normalizeHumanSupervisionReply, shouldShowHumanSupervision } from "./endoBotHumanSupervision";

describe("human EndoBot supervision safeguards", () => {
  it("normalizes a human reply before checking its length", () => {
    expect(normalizeHumanSupervisionReply("\r\n  Olá\r\n")).toBe("Olá");
    expect(isHumanSupervisionReplyValid("  \n  ")).toBe(false);
    expect(isHumanSupervisionReplyValid("Olá, estamos aqui para ajudar com informação geral.")).toBe(true);
  });

  it("keeps the human composer inside the server-side message limit", () => {
    expect(isHumanSupervisionReplyValid("a".repeat(HUMAN_SUPERVISION_REPLY_LIMIT))).toBe(true);
    expect(isHumanSupervisionReplyValid("a".repeat(HUMAN_SUPERVISION_REPLY_LIMIT + 1))).toBe(false);
  });

  it("models only explicit pause and resume transitions", () => {
    expect(nextHumanTakeoverStatus(true)).toBe("paused");
    expect(nextHumanTakeoverStatus(false)).toBe("automated");
  });

  it("never renders the workspace for other staff roles or a locked owner session", () => {
    expect(shouldShowHumanSupervision(false, true)).toBe(false);
    expect(shouldShowHumanSupervision(true, false)).toBe(false);
    expect(shouldShowHumanSupervision(true, true)).toBe(true);
  });
});
