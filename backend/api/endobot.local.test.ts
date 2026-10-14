import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ipBlock: vi.fn(),
  userId: vi.fn(),
  knowledge: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    const chain: any = { select: () => chain, eq: () => chain, gt: () => chain, maybeSingle: mocks.ipBlock };
    return { from: () => chain };
  },
}));

vi.mock("../lib/knowledge.js", () => ({ buildKnowledgeContext: (chunks: Array<{ text: string }>) => chunks.map((chunk) => chunk.text).join(" "), getRelevantKnowledge: mocks.knowledge }));
vi.mock("../lib/supabaseAuth.js", () => ({ getSupabaseUserId: mocks.userId, isSupabaseAccountActive: async () => true }));

type TestResponse = { statusCode: number; body: any; setHeader: () => void; status: (code: number) => TestResponse; json: (body: unknown) => TestResponse; end: () => TestResponse };
function createResponse(): TestResponse {
  const result: TestResponse = {
    statusCode: 0, body: null,
    setHeader() {}, status(code) { result.statusCode = code; return result; },
    json(body) { result.body = body; return result; }, end() { return result; },
  };
  return result;
}

let requestIndex = 0;
function createRequest(authorization?: string, question = "teste") {
  return {
    method: "POST", headers: { origin: "https://endo-acolhe.vercel.app", "content-type": "application/json", authorization },
    body: { question, history: [{ role: "user", content: "Olá" }, { role: "assistant", content: "Como posso ajudar?" }] },
    socket: { remoteAddress: `192.0.2.${++requestIndex}` },
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-key");
  vi.stubEnv("OLLAMA_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("NVIDIA_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY_FALLBACK", "");
  mocks.ipBlock.mockResolvedValue({ data: null, error: null });
  mocks.userId.mockResolvedValue(null);
  mocks.knowledge.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers();
});

describe("acesso e inferência local do EndoBot", () => {
  it("retorna erro recuperável e não ignora bloqueios quando Supabase falha", async () => {
    mocks.ipBlock.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest() as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(503);
    expect(result.body).toMatchObject({ code: "db_unavailable", retryable: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encerra a validação inicial travada antes de iniciar inferência", async () => {
    vi.useFakeTimers();
    mocks.ipBlock.mockImplementation(() => new Promise(() => {}));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { default: handler } = await import("./endobot.js");
    const pending = handler(createRequest() as any, createResponse() as any);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending as unknown as TestResponse;
    expect(result.statusCode).toBe(503);
    expect(result.body.code).toBe("db_unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("continua recusando uma rede bloqueada", async () => {
    mocks.ipBlock.mockResolvedValue({ data: { expires_at: "2099-01-01T00:00:00Z" }, error: null });
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest() as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(403);
  });

  it("continua recusando token inválido", async () => {
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest("Bearer invalid") as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(401);
  });

  it("aceita um cold start de 20s, mantém histórico e não inventa contexto para teste", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(async (_input, _init) => {
      await new Promise((resolve) => setTimeout(resolve, 20_000));
      return new Response(JSON.stringify({ message: { content: "Olá! Estou aqui para ajudar." } }));
    });
    vi.stubGlobal("fetch", fetcher);
    const { default: handler } = await import("./endobot.js");
    const pending = handler(createRequest() as any, createResponse() as any);
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await pending as unknown as TestResponse;
    expect(result.statusCode).toBe(200);
    expect(result.body.answer).toBe("Olá! Estou aqui para ajudar.");
    const payload = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string);
    expect(payload.messages).toContainEqual({ role: "assistant", content: "Como posso ajudar?" });
    expect(mocks.knowledge).not.toHaveBeenCalled();
  });

  it("sinaliza falha transitória da IA como recuperável", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: { content: "" } })));
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest() as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(503);
    expect(result.body).toMatchObject({ code: "ai_unavailable", retryable: true });
  });

  it("não responde a uma pergunta clínica sem consultar o acervo se o Storage falhar", async () => {
    mocks.knowledge.mockRejectedValue(new Error("Storage unavailable"));
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest(undefined, "Quais sintomas incluem dor pélvica?") as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(503);
    expect(result.body).toMatchObject({ code: "knowledge_unavailable", retryable: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("encaminha os trechos do acervo ao modelo para uma pergunta clínica", async () => {
    const reference = "Dor pélvica e cólicas podem ser sintomas associados à endometriose.";
    mocks.knowledge.mockResolvedValue([{ source: "6.json", text: reference, score: 1 }]);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ message: { content: "Converse com um profissional sobre seus sintomas." } })));
    vi.stubGlobal("fetch", fetcher);
    const { default: handler } = await import("./endobot.js");
    const result = await handler(createRequest(undefined, "Quais sintomas incluem dor pélvica?") as any, createResponse() as any) as unknown as TestResponse;
    expect(result.statusCode).toBe(200);
    const messages = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string).messages;
    expect(messages).toContainEqual({ role: "system", content: reference });
  });
});
