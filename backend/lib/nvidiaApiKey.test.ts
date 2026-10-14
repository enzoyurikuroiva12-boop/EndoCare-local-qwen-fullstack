import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NVIDIA_CHAT_ENDPOINT } from "./nvidia.js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    const chain: any = {
      select: () => chain, eq: () => chain, gt: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return { from: () => chain };
  },
}));

vi.mock("./knowledge.js", () => ({ buildKnowledgeContext: () => "", getRelevantKnowledge: async () => [] }));

function createResponse() {
  const result = {
    statusCode: 0, body: null as any,
    setHeader() {},
    status(code: number) { result.statusCode = code; return result; },
    json(body: unknown) { result.body = body; return result; },
    end() { return result; },
  };
  return result;
}

async function askEndoBot() {
  const { default: handler } = await import("../api/endobot.js");
  const response = createResponse();
  await handler({
    method: "POST",
    headers: { origin: "https://endo-acolhe.vercel.app", "content-type": "application/json" },
    body: { question: "Olá" },
    socket: { remoteAddress: "192.0.2.1" },
  } as any, response as any);
  return response;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  vi.stubEnv("OLLAMA_ENABLED", "false");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("NVIDIA_API_KEY", "");
  vi.stubEnv("NVIDIA_UPSTREAM_URL", "");
  vi.stubEnv("NVIDIA_MODEL", "test-model");
  vi.stubEnv("OPENAI_API_KEY_FALLBACK", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("NVIDIA API configuration", () => {
  it("does not call NVIDIA without an optional API key", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const response = await askEndoBot();

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ code: "ai_unavailable", retryable: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the configured server key and model to NVIDIA", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-key");
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Olá! Como posso ajudar?" } }],
    })));
    vi.stubGlobal("fetch", fetcher);

    const response = await askEndoBot();

    expect(response.statusCode).toBe(200);
    expect(response.body.answer).toBe("Olá! Como posso ajudar?");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(NVIDIA_CHAT_ENDPOINT);
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-nvidia-key");
    expect(JSON.parse(options?.body as string)).toMatchObject({ model: "test-model" });
  });

  it("continues to the next configured provider after NVIDIA rejects a request", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-key");
    vi.stubEnv("OPENAI_API_KEY_FALLBACK", "test-openai-key");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Texto em uma resposta de erro." } }],
      }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Olá! Como posso ajudar?" } }],
      })));
    vi.stubGlobal("fetch", fetcher);

    const response = await askEndoBot();

    expect(response.statusCode).toBe(200);
    expect(response.body.answer).toBe("Olá! Como posso ajudar?");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer test-openai-key");
  });
});

describe.each([
  ["NVIDIA", "NVIDIA_API_KEY"],
  ["OpenRouter", "OPENROUTER_API_KEY"],
  ["OpenAI", "OPENAI_API_KEY_FALLBACK"],
])("%s upstream errors", (_provider, apiKeyVariable) => {
  it.each([401, 429, 451, 500])("rejects HTTP %i even when its payload contains answer text", async (status) => {
    vi.stubEnv(apiKeyVariable, "test-provider-key");
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Texto em uma resposta de erro." } }],
    }), { status }));
    vi.stubGlobal("fetch", fetcher);

    const response = await askEndoBot();

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ code: "ai_unavailable", retryable: true });
    expect(response.body.answer).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
