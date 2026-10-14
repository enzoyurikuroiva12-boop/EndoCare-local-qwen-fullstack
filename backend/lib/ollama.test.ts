import { afterEach, describe, expect, it, vi } from "vitest";
import { getOllamaAnswer, getOllamaTimeoutMs, isOllamaModelAvailable } from "./ollama.js";
import { UpstreamTimeoutError } from "./upstreamResilience.js";

const request = { baseUrl: "http://127.0.0.1:11434", model: "qwen2.5:3b", messages: [{ role: "user", content: "teste" }] };

afterEach(() => vi.useRealTimers());

describe("Qwen local", () => {
  it("permite carregar o modelo além do antigo limite de 12 segundos", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async (_input, _init) => {
      await new Promise((resolve) => setTimeout(resolve, 20_000));
      return new Response(JSON.stringify({ message: { content: "Olá, como posso ajudar?" } }));
    });
    const answer = getOllamaAnswer({ ...request, fetcher });
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(answer).resolves.toBe("Olá, como posso ajudar?");
    const payload = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(payload.keep_alive).toBe("10m");
  });

  it("cancela também um corpo que parou depois dos headers", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null = null;
    const fetcher: typeof fetch = async (_input, init) => {
      requestSignal = init?.signal ?? null;
      return { ok: true, status: 200, text: () => new Promise<string>(() => {}) } as Response;
    };
    const answer = getOllamaAnswer({ ...request, timeoutMs: 5_000, fetcher });
    const failure = expect(answer).rejects.toBeInstanceOf(UpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await failure;
    expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  it("recusa erro do Ollama e resposta vazia", async () => {
    await expect(getOllamaAnswer({ ...request, fetcher: async () => new Response(JSON.stringify({ error: "model not found" }), { status: 404 }) })).rejects.toThrow("Ollama indisponível (404)");
    await expect(getOllamaAnswer({ ...request, fetcher: async () => new Response(JSON.stringify({ message: { content: " " } })) })).rejects.toThrow("Ollama indisponível (200)");
  });

  it("mantém um orçamento próprio e limitado para inferência local", () => {
    expect(getOllamaTimeoutMs(undefined)).toBe(60_000);
    expect(getOllamaTimeoutMs("2000")).toBe(5_000);
    expect(getOllamaTimeoutMs("120000")).toBe(90_000);
  });

  it("não anuncia disponibilidade apenas porque Ollama responde sem o modelo instalado", async () => {
    const installedModels: typeof fetch = async () => new Response(JSON.stringify({ models: [{ name: "qwen2.5:3b" }] }));
    await expect(isOllamaModelAvailable(request.baseUrl, request.model, installedModels)).resolves.toBe(true);
    await expect(isOllamaModelAvailable(request.baseUrl, "missing:3b", installedModels)).resolves.toBe(false);
    await expect(isOllamaModelAvailable(request.baseUrl, request.model, async () => new Response("invalid"))).resolves.toBe(false);
  });
});
