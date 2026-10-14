export const HUMAN_SUPERVISION_REPLY_LIMIT = 2400;

export type HumanTakeoverStatus = "automated" | "paused";

export function normalizeHumanSupervisionReply(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function isHumanSupervisionReplyValid(value: string): boolean {
  const normalized = normalizeHumanSupervisionReply(value);
  return normalized.length > 0 && normalized.length <= HUMAN_SUPERVISION_REPLY_LIMIT;
}

export function nextHumanTakeoverStatus(paused: boolean): HumanTakeoverStatus {
  return paused ? "paused" : "automated";
}

export function shouldShowHumanSupervision(isOwner: boolean, adminGateUnlocked: boolean): boolean {
  return isOwner && adminGateUnlocked;
}
