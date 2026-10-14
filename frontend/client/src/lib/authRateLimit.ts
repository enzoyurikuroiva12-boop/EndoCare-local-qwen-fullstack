export type AuthAction = "email-login" | "email-signup" | "email-verify" | "resend-link" | "password-recovery-request" | "profile-update" | "password-update" | "admin-password-reset" | "admin-password-direct" | "admin-access-gate";

const policies: Record<AuthAction, { limit: number; windowMs: number }> = {
  "email-login": { limit: 5, windowMs: 30_000 },
  "email-signup": { limit: 4, windowMs: 10 * 60_000 },
  "email-verify": { limit: 6, windowMs: 10 * 60_000 },
  "resend-link": { limit: 3, windowMs: 10 * 60_000 },
  "password-recovery-request": { limit: 3, windowMs: 15 * 60_000 },
  "profile-update": { limit: 4, windowMs: 10 * 60_000 },
  "password-update": { limit: 3, windowMs: 15 * 60_000 },
  "admin-password-reset": { limit: 3, windowMs: 15 * 60_000 },
  "admin-password-direct": { limit: 3, windowMs: 15 * 60_000 },
  "admin-access-gate": { limit: 5, windowMs: 15 * 60_000 },
};

const MAX_STORED_ATTEMPTS = 16;

type LimitResult = { allowed: true; timestamps: number[]; retryAfterSeconds: 0 } | { allowed: false; timestamps: number[]; retryAfterSeconds: number };

export function evaluateAuthLimit(action: AuthAction, timestamps: number[], now = Date.now()): LimitResult {
  const policy = policies[action];
  const recent = timestamps.filter((timestamp) => Number.isFinite(timestamp) && timestamp > now - policy.windowMs && timestamp <= now);
  if (recent.length >= policy.limit) {
    return { allowed: false, timestamps: recent, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + policy.windowMs - now) / 1_000)) };
  }
  return { allowed: true, timestamps: [...recent, now], retryAfterSeconds: 0 };
}

function storageKey(action: AuthAction) {
  return `endoacolhe:auth-rate:${action}`;
}

function readAttempts(action: AuthAction): number[] {
  try {
    const raw = window.localStorage.getItem(storageKey(action));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).slice(-MAX_STORED_ATTEMPTS) : [];
  } catch {
    return [];
  }
}

function saveAttempts(action: AuthAction, timestamps: number[]) {
  try { window.localStorage.setItem(storageKey(action), JSON.stringify(timestamps.slice(-MAX_STORED_ATTEMPTS))); } catch { /* A proteção do servidor continua válida quando o storage não está disponível. */ }
}

export function reserveAuthAttempt(action: AuthAction) {
  const result = evaluateAuthLimit(action, readAttempts(action));
  if (result.allowed) saveAttempts(action, result.timestamps);
  return result;
}
