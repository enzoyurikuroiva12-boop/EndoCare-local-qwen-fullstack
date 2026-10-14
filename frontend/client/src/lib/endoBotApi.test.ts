import { afterEach, describe, expect, it, vi } from "vitest";
import { EndoBotApiError, requestEndoBot } from "./endoBotApi";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("EndoBot request recovery", () => {
  it("preserves a successful reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: "Olá." }))));
    await expect(requestEndoBot("http://localhost/api/endobot", {})).resolves.toEqual({ answer: "Olá." });
  });

  it("reports database and rate-limit errors separately from network availability", async () => {
    for (const [status, code] of [[503, "db_unavailable"], [429, "rate_limit"]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Tente novamente.", code, retryable: true }), { status })));
      await expect(requestEndoBot("http://localhost/api/endobot", {})).rejects.toMatchObject({ status, code, retryable: true, message: "Tente novamente." });
    }
  });

  it("keeps invalid sessions distinguishable from transient outages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401 })));
    await expect(requestEndoBot("http://localhost/api/endobot", {})).rejects.toMatchObject({ status: 401, code: "http_401", retryable: false });
  });

  it("times out a stalled body after the headers arrive", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })),
    })));
    const result = requestEndoBot("http://localhost/api/endobot", {}, 1000);
    const assertion = expect(result).rejects.toMatchObject({ code: "request_timeout", retryable: true });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it("identifies a connection failure without confusing it with an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(requestEndoBot("http://localhost/api/endobot", {})).rejects.toBeInstanceOf(EndoBotApiError);
    await expect(requestEndoBot("http://localhost/api/endobot", {})).rejects.toMatchObject({ code: "network_error", status: 0 });
  });
});
