const DEFAULT_VOICE_URL = "http://127.0.0.1:7862";
const MAX_WAV_BYTES = 20 * 1024 * 1024;

export class LocalVoiceError extends Error {
  constructor(message: string, readonly status = 503, readonly code = "tts_unavailable") {
    super(message);
    this.name = "LocalVoiceError";
  }
}

export function getLocalVoiceUrl() {
  const configured = (process.env.OMNIVOICE_BASE_URL || DEFAULT_VOICE_URL).replace(/\/$/, "");
  const url = new URL(configured);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new LocalVoiceError("O endereço do OmniVoice deve apontar para o serviço local.");
  }
  return url.origin;
}

export function voiceTimeoutMs() {
  const value = Number(process.env.OMNIVOICE_TIMEOUT_MS || 180_000);
  return Number.isFinite(value) ? Math.min(240_000, Math.max(5_000, value)) : 180_000;
}

export async function getLocalVoiceStatus() {
  try {
    const response = await fetch(`${getLocalVoiceUrl()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return { status: "unavailable", asr: "unavailable", tts: "unavailable" } as const;
    const health = await response.json().catch(() => null) as { service?: unknown; status?: unknown; asr?: unknown; tts?: unknown } | null;
    if (health?.service !== "endobot-local-voice") return { status: "unavailable", asr: "unavailable", tts: "unavailable" } as const;
    const asr = health.asr === "ready" ? "ready" : health.asr === "loading" ? "loading" : "unavailable";
    const tts = health.tts === "ready" ? "ready" : health.tts === "loading" ? "loading" : "unavailable";
    const status = asr === "ready" && tts === "ready" ? "ready" : asr === "unavailable" || tts === "unavailable" || health.status === "error" ? "unavailable" : "loading";
    return { status, asr, tts } as const;
  } catch {
    return { status: "unavailable", asr: "unavailable", tts: "unavailable" } as const;
  }
}

async function serviceError(response: Response, fallback: string, code = "tts_unavailable") {
  const payload = await response.json().catch(() => null) as { detail?: unknown } | null;
  const message = typeof payload?.detail === "string" ? payload.detail : fallback;
  return new LocalVoiceError(message, [400, 413, 422, 429].includes(response.status) ? response.status : 503, code);
}

export async function synthesizeLocalSpeech(text: string, preferredLanguage = "pt") {
  const input = text.trim();
  if (!input || input.length > 6000) throw new LocalVoiceError("Informe um texto curto para ouvir.", 400, "invalid_text");
  try {
    const response = await fetch(`${getLocalVoiceUrl()}/v1/audio/speech`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, language: preferredLanguage.slice(0, 12) || "pt" }),
      signal: AbortSignal.timeout(voiceTimeoutMs()),
    });
    if (!response.ok) throw await serviceError(response, "O OmniVoice está carregando ou está indisponível. Inicie o serviço de voz local.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 44 || bytes.length > MAX_WAV_BYTES || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
      throw new LocalVoiceError("O OmniVoice não devolveu um áudio WAV válido.");
    }
    return { audioBase64: bytes.toString("base64"), audioMimeType: "audio/wav", provider: "omnivoice", voice: "female" };
  } catch (error) {
    if (error instanceof LocalVoiceError) throw error;
    throw new LocalVoiceError("Não foi possível preparar a voz. Verifique se o OmniVoice local está iniciado.");
  }
}

export async function transcribeLocalAudio(audio: Buffer, mimeType: string, extension: string) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `endobot.${extension}`);
  try {
    const response = await fetch(`${getLocalVoiceUrl()}/v1/audio/transcriptions`, {
      method: "POST", body: form, signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw await serviceError(response, "O reconhecimento de voz local está indisponível.", response.status === 422 ? "transcription_failed" : "asr_unavailable");
    const payload = await response.json() as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text || text.length > 700) throw new LocalVoiceError("Não foi possível entender uma pergunta curta na gravação.", 422, "transcription_failed");
    return text;
  } catch (error) {
    if (error instanceof LocalVoiceError) throw error;
    throw new LocalVoiceError("Não foi possível reconhecer sua fala. Verifique se o serviço de voz local está iniciado.", 503, "asr_unavailable");
  }
}
