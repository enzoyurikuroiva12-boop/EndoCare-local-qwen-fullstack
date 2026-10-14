import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./endobot-voice.js";

function response() {
  const reply = { code: 0, payload: null as any, setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), end: vi.fn() };
  reply.status.mockImplementation((code: number) => { reply.code = code; return reply; });
  reply.json.mockImplementation((payload: unknown) => { reply.payload = payload; return reply; });
  return reply;
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("EndoBot recorded voice", () => {
  it("returns only the transcript so the frontend can persist the message before chat", async () => {
    vi.stubEnv("ENDOBOT_ASR_PROVIDER", "local");
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ text: "Quais perguntas posso fazer na consulta?" }));
    vi.stubGlobal("fetch", fetchMock);
    const req = { method: "POST", headers: {}, socket: { remoteAddress: "test-transcription-only" },
      body: { audioBase64: "dGVzdGU=", mimeType: "audio/wav", transcribeOnly: true } } as unknown as VercelRequest;
    const res = response();
    await handler(req, res as unknown as VercelResponse);
    expect(res.code).toBe(200);
    expect(res.payload).toEqual({ transcript: "Quais perguntas posso fazer na consulta?" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recognizes speech and returns the answer without waiting for TTS when requested", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY_FALLBACK", "");
    vi.stubEnv("ENDOBOT_ASR_PROVIDER", "local");
    vi.stubEnv("ENDOBOT_PUBLIC_URL", "http://127.0.0.1:3000");
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ text: "Como organizar minhas perguntas?" }))
      .mockResolvedValueOnce(Response.json({ answer: "Anote suas dúvidas para conversar no atendimento.", securityAction: "allow" }));
    vi.stubGlobal("fetch", fetchMock);
    const req = { method: "POST", headers: { authorization: "Bearer test-local-token" }, socket: { remoteAddress: "test-without-cloud" },
      body: { audioBase64: Buffer.from("sample audio").toString("base64"), mimeType: "audio/webm", generateAudio: false } } as unknown as VercelRequest;
    const res = response();
    await handler(req, res as unknown as VercelResponse);
    expect(res.code).toBe(200);
    expect(res.payload).toMatchObject({ transcript: "Como organizar minhas perguntas?", answer: "Anote suas dúvidas para conversar no atendimento.", audioBase64: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:7862/v1/audio/transcriptions");
    expect(fetchMock.mock.calls[1][0]).toBe("http://127.0.0.1:3000/api/endobot");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer test-local-token");
  });

  it("keeps a valid chat response and reports the OmniVoice audio failure", async () => {
    vi.stubEnv("ENDOBOT_ASR_PROVIDER", "local");
    vi.stubEnv("ENDOBOT_PUBLIC_URL", "http://127.0.0.1:3000");
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ text: "Olá" }))
      .mockResolvedValueOnce(Response.json({ answer: "Olá, como posso ajudar?" }))
      .mockRejectedValueOnce(new Error("ECONNREFUSED")));
    const req = { method: "POST", headers: {}, socket: { remoteAddress: "test-tts-failure" }, body: { audioBase64: "dGVzdGU=", mimeType: "audio/wav" } } as unknown as VercelRequest;
    const res = response();
    await handler(req, res as unknown as VercelResponse);
    expect(res.code).toBe(200);
    expect(res.payload.answer).toBe("Olá, como posso ajudar?");
    expect(res.payload.audioBase64).toBeNull();
    expect(res.payload.audioError).toMatch(/OmniVoice/);
  });
});
