import { describe, expect, it, vi } from "vitest";
import { createTimedFetch, getBoundedTimeoutMs, UpstreamCircuitBreaker, UpstreamTimeoutError, withTimeout } from "./upstreamResilience.js";

describe("resiliência do upstream", () => {
  it("limita timeouts vindos do ambiente", () => {
    expect(getBoundedTimeoutMs(undefined, 12000, 2000, 20000)).toBe(12000);
    expect(getBoundedTimeoutMs("500", 12000, 2000, 20000)).toBe(2000);
    expect(getBoundedTimeoutMs("30000", 12000, 2000, 20000)).toBe(20000);
    expect(getBoundedTimeoutMs("invalid", 12000, 2000, 20000)).toBe(12000);
  });

  it("encerra uma operação lenta com erro próprio e limpa o timer", async () => {
    await expect(withTimeout(new Promise((resolve) => setTimeout(resolve, 30)), 5)).rejects.toBeInstanceOf(UpstreamTimeoutError);
  });

  it("abre após falhas consecutivas e fecha depois do cooldown", () => {
    vi.useFakeTimers();
    const breaker = new UpstreamCircuitBreaker(2, 1000);
    expect(breaker.isOpen).toBe(false);
    breaker.recordFailure();
    expect(breaker.isOpen).toBe(false);
    breaker.recordFailure();
    expect(breaker.isOpen).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(breaker.isOpen).toBe(false);
    breaker.recordFailure();
    breaker.recordSuccess();
    expect(breaker.isOpen).toBe(false);
    vi.useRealTimers();
  });

  it("limita e cancela a leitura de um corpo do Supabase que fica pendente", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    const fetcher: typeof fetch = async (_input, init) => {
      signal = init?.signal ?? null;
      return { body: {}, arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) } as Response;
    };
    const pending = createTimedFetch(5_000, fetcher)("https://supabase.test/rest/v1/endobot_ip_blocks");
    const failure = expect(pending).rejects.toBeInstanceOf(UpstreamTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await failure;
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("preserva JSON e respostas sem corpo do Supabase", async () => {
    const jsonFetch = createTimedFetch(5_000, async () => new Response('{"status":"active"}', { headers: { "Content-Type": "application/json" } }));
    const result = await jsonFetch("https://supabase.test");
    await expect(result.json()).resolves.toEqual({ status: "active" });
    expect(result.headers.get("Content-Type")).toBe("application/json");
    const emptyFetch = createTimedFetch(5_000, async () => new Response(null, { status: 204 }));
    const empty = await emptyFetch("https://supabase.test");
    expect(empty.status).toBe(204);
    expect(await empty.text()).toBe("");
  });
});
