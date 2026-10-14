import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gt: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return { from: () => chain };
  },
}));

vi.mock("../lib/knowledge.js", () => ({
  buildKnowledgeContext: () => "",
  getRelevantKnowledge: async () => [],
}));

vi.mock("../lib/supabaseAuth.js", () => ({
  getSupabaseUserId: async () => null,
  isSupabaseAccountActive: async () => true,
}));

vi.mock("../lib/safety.js", () => ({
  blockedAnswer: () => "Resposta segura de fallback.",
  forbiddenPattern: /$^/,
  injectionPattern: /$^/,
  sanitizeQuestion: (content: string) => ({ content, redacted: false }),
}));

vi.mock("../lib/language.js", () => ({
  detectLanguage: () => "pt",
  responseLanguageInstruction: () => "Responda em português.",
}));

const toxiproxyUrl = process.env.ENDOBOT_TOXIPROXY_ADMIN_URL;
const runIntegration = Boolean(toxiproxyUrl);
const describeIntegration = runIntegration ? describe : describe.skip;

type TestResponse = {
  statusCode: number | null;
  body: unknown;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => TestResponse;
  status: (code: number) => TestResponse;
  json: (body: unknown) => TestResponse;
  end: () => TestResponse;
};

function createResponse(): TestResponse {
  const result: TestResponse = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { result.headers[name] = value; return result; },
    status(code) { result.statusCode = code; return result; },
    json(body) { result.body = body; return result; },
    end() { return result; },
  };
  return result;
}

function createRequest() {
  return {
    method: "POST",
    headers: { origin: "https://endo-acolhe.vercel.app", "content-type": "application/json" },
    body: { question: "O que é endometriose?", preferredLanguage: "pt" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

async function addToxic(name: string, type: string, attributes: Record<string, number>) {
  const result = await fetch(`${toxiproxyUrl}/proxies/endobot-upstream/toxics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type, stream: "downstream", attributes }),
  });
  if (!result.ok) throw new Error(`Toxiproxy rejected toxic: ${result.status}`);
}

async function removeToxic(name: string) {
  await fetch(`${toxiproxyUrl}/proxies/endobot-upstream/toxics/${name}`, { method: "DELETE" });
}

describeIntegration("fault injection controlado do EndoBot", () => {
  let handler: (request: any, response: any) => Promise<any>;

  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "local-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-service-role";
    process.env.VITE_SUPABASE_URL = "https://local.supabase.test";
    process.env.ENDOBOT_UPSTREAM_URL = "http://127.0.0.1:18081/chat/completions";
    process.env.ENDOBOT_UPSTREAM_TIMEOUT_MS = "2000";
    process.env.OLLAMA_ENABLED = "false";
    ({ default: handler } = await import("./endobot.js"));
  });

  afterAll(async () => {
    await removeToxic("latency");
    delete process.env.ENDOBOT_UPSTREAM_URL;
    delete process.env.ENDOBOT_UPSTREAM_TIMEOUT_MS;
    delete process.env.OLLAMA_ENABLED;
  });

  it("responde normalmente pelo proxy local sem toxic", async () => {
    const result = await handler(createRequest(), createResponse());
    expect(result.statusCode).toBe(200);
    expect((result.body as { answer: string }).answer).toContain("Resposta controlada do upstream local");
  });

  it("converte latência upstream em fallback antes do orçamento do cliente", async () => {
    await addToxic("latency", "latency", { latency: 2500, jitter: 0 });
    const startedAt = Date.now();
    try {
      const result = await handler(createRequest(), createResponse());
      const elapsedMs = Date.now() - startedAt;
      expect(result.statusCode).toBe(503);
      expect((result.body as { error: string }).error).toContain("temporariamente offline");
      expect(elapsedMs).toBeLessThan(2400);
    } finally {
      await removeToxic("latency");
    }
  });
});
