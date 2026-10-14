export const NVIDIA_CHAT_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
export const DEFAULT_NVIDIA_MODEL = "mistralai/mistral-large";

export type NvidiaChatPayload = {
  choices?: Array<{ message?: { content?: string | null }; text?: string | null }>;
  answer?: string | null;
};

export function getNvidiaEndpoint(value?: string) {
  return value?.trim() || NVIDIA_CHAT_ENDPOINT;
}

export function getNvidiaModel(value?: string) {
  return value?.trim() || DEFAULT_NVIDIA_MODEL;
}

export function getNvidiaModelsEndpoint(value?: string) {
  return getNvidiaEndpoint(value).replace(/\/chat\/completions\/?$/, "/models");
}

export function getNvidiaAnswer(payload: NvidiaChatPayload) {
  const candidate = payload.answer || payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}
