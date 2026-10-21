import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalVoiceStatus, getLocalVoiceUrl, synthesizeLocalSpeech, transcribeLocalAudio } from "./localVoice.js";

function wav() {
  const bytes = Buffer.alloc(48);
  bytes.write("RIFF", 0);
  bytes.write("WAVE", 8);
  return bytes;
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("EndoBot local voice", () => {
  it("accepts only a plain loopback service URL", () => {
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    expect(getLocalVoiceUrl()).toBe("http://127.0.0.1:7862");
    for (const address of ["https://example.com", "http://192.168.1.5:7862", "http://localhost:7862/another", "http://user:pass@localhost:7862"]) {
      vi.stubEnv("OMNIVOICE_BASE_URL", address);
      expect(() => getLocalVoiceUrl()).toThrow();
    }
  });

  it("reports only safe ASR and TTS readiness states to the frontend", async () => {
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ service: "endobot-local-voice", status: "loading", asr: "ready", tts: "loading", device: "cuda:0" }))
      .mockResolvedValueOnce(Response.json({ service: "endobot-local-voice", status: "ready", asr: "ready", tts: "ready", device: "cuda:0" }))
      .mockRejectedValueOnce(new Error("connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLocalVoiceStatus()).resolves.toEqual({ status: "loading", asr: "ready", tts: "loading" });
    await expect(getLocalVoiceStatus()).resolves.toEqual({ status: "ready", asr: "ready", tts: "ready" });
    await expect(getLocalVoiceStatus()).resolves.toEqual({ status: "unavailable", asr: "unavailable", tts: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.every(([url]) => url === "http://127.0.0.1:7862/health")).toBe(true);
  });

  it("returns real WAV bytes from the local Portuguese voice without a cloud key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY_FALLBACK", "");
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn().mockResolvedValue(new Response(wav(), { headers: { "X-EndoCare-TTS-Provider": "windows-sapi-pt-BR" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await synthesizeLocalSpeech("Olá, estou aqui para ajudar.", "pt-BR");
    expect(result.audioMimeType).toBe("audio/wav");
    expect(result.provider).toBe("windows-sapi-pt-BR");
    expect(result.voice).toBe("female-pt-BR");
    expect(Buffer.from(result.audioBase64, "base64").equals(wav())).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:7862/v1/audio/speech", expect.objectContaining({
      body: JSON.stringify({ input: "Olá, estou aqui para ajudar.", language: "pt-BR" }),
    }));
  });

  it("reports unavailable or corrupt TTS explicitly instead of switching providers", async () => {
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 })).mockResolvedValueOnce(new Response("not a WAV"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(synthesizeLocalSpeech("Olá")).rejects.toMatchObject({ code: "tts_unavailable", status: 503 });
    await expect(synthesizeLocalSpeech("Olá")).rejects.toMatchObject({ code: "tts_unavailable", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("http://127.0.0.1:7862/"))).toBe(true);
  });

  it("transcribes the recorded audio through the local Whisper service", async () => {
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "Como organizar as perguntas para a consulta?" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await transcribeLocalAudio(wav(), "audio/wav", "wav")).toBe("Como organizar as perguntas para a consulta?");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:7862/v1/audio/transcriptions", expect.objectContaining({ method: "POST", body: expect.any(FormData) }));
  });

  it("preserves the CPU text limit and does not retry rejected synthesis", async () => {
    vi.stubEnv("OMNIVOICE_BASE_URL", "http://127.0.0.1:7862");
    const message = "A voz na CPU aceita até 300 caracteres. Peça uma resposta mais curta para ouvir.";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ detail: message }, { status: 413 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(synthesizeLocalSpeech("Resposta longa")).rejects.toMatchObject({ status: 413, message });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
