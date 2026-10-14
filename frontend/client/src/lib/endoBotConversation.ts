import { EndoBotApiError } from "./endoBotApi";

export type EndoBotHistoryMode = "saved" | "temporary";

// Apply this preference only to a new session, never to an existing saved conversation.
export function getInitialEndoBotHistoryMode(apiBase: string): EndoBotHistoryMode {
  try {
    const url = new URL(apiBase);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    // URL parsing normalizes alternate numeric IP spellings; keep this opt-in limited to explicit loopback hosts.
    const explicitLoopback = /^https?:\/\/(?:[^/?#]*@)?(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(apiBase.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && loopback && explicitLoopback ? "temporary" : "saved";
  } catch {
    return "saved";
  }
}

export function throwIfEndoBotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
}

export function createEndoBotRequestHeaders(options: {
  authenticated: boolean;
  accessToken?: string | null;
  sessionError?: unknown;
  sessionExpiredMessage: string;
}): Record<string, string> {
  const accessToken = options.accessToken?.trim();
  if (options.authenticated && (options.sessionError || !accessToken)) {
    throw new EndoBotApiError(options.sessionExpiredMessage, 401, "session_expired", false);
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

type QuestionFlow<T> = {
  question: string;
  authenticated: boolean;
  historyMode?: EndoBotHistoryMode;
  humanTakeoverPaused: boolean;
  signal?: AbortSignal;
  ensureConversation: (question: string) => Promise<string | null>;
  persistQuestion: (conversationId: string) => Promise<void>;
  requestAnswer: (conversationId: string | null) => Promise<T>;
};

// Text and transcribed speech use the same history and human-review checks.
export async function submitEndoBotQuestion<T>(flow: QuestionFlow<T>) {
  throwIfEndoBotCancelled(flow.signal);
  const conversationId = flow.authenticated && flow.historyMode !== "temporary" ? await flow.ensureConversation(flow.question) : null;
  throwIfEndoBotCancelled(flow.signal);
  if (conversationId) {
    await flow.persistQuestion(conversationId);
    throwIfEndoBotCancelled(flow.signal);
  }
  if (flow.humanTakeoverPaused) return { kind: "human" as const, conversationId };
  const result = await flow.requestAnswer(conversationId);
  throwIfEndoBotCancelled(flow.signal);
  return { kind: "assistant" as const, conversationId, result };
}
