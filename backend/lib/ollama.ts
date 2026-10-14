import { getBoundedTimeoutMs, withAbortableTimeout } from "./upstreamResilience.js";

type OllamaMessage = { role: string; content: string };

// Local inference includes loading the model and queueing behind another request.
// Its deadline therefore differs from the network timeout used by cloud providers.
export function getOllamaTimeoutMs(value = process.env.ENDOBOT_OLLAMA_TIMEOUT_MS) {
  return getBoundedTimeoutMs(value, 60_000, 5_000, 90_000);
}

export async function isOllamaModelAvailable(baseUrl: string, model: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    return await withAbortableTimeout(async (signal) => {
      const result = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal });
      if (!result.ok) return false;
      const payload = await result.json() as { models?: Array<{ name?: string; model?: string }> };
      const expectedModel = model.includes(":") ? model : `${model}:latest`;
      return Array.isArray(payload.models) && payload.models.some((entry) => entry?.name === expectedModel || entry?.model === expectedModel);
    }, 4_000);
  } catch {
    return false;
  }
}

export async function getOllamaAnswer(params: {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
  timeoutMs?: number;
  fetcher?: typeof fetch;
}): Promise<string> {
  const { baseUrl, model, messages, timeoutMs = getOllamaTimeoutMs(), fetcher = fetch } = params;
  return withAbortableTimeout(async (signal) => {
    const result = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: "10m",
        options: { temperature: 0.25, num_predict: 320 },
      }),
      signal,
    });
    const rawPayload = await result.text();
    if (rawPayload.length > 200_000) throw new Error("Resposta do Qwen excedeu o limite de segurança");
    const payload = JSON.parse(rawPayload) as { message?: { content?: unknown } };
    const candidate = payload.message?.content;
    const answer = typeof candidate === "string" ? candidate.trim() : "";
    if (!result.ok || !answer) throw new Error(`Ollama indisponível (${result.status})`);
    return answer;
  }, timeoutMs);
}
