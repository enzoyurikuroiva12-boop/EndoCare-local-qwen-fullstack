export const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";

export function getOpenRouterEndpoint(value?: string) {
  const candidate = value?.trim();
  return candidate || OPENROUTER_CHAT_ENDPOINT;
}
export const OPENROUTER_CHAT_OPTIONS = { reasoning: { enabled: false }, max_tokens: 420 } as const;

type OpenRouterPayload = { choices?: Array<{ message?: { content?: string | null }; text?: string | null }>; answer?: string | null };

export function getOpenRouterModel(value?: string) {
  return value?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function getOpenRouterAnswer(payload: OpenRouterPayload) {
  const candidate = payload.answer || payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}
