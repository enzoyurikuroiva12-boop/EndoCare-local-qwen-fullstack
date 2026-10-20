import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAllowedEndoBotOrigin } from "../lib/cors.js";
import { getLocalVoiceStatus, LocalVoiceError, synthesizeLocalSpeech, transcribeLocalAudio } from "../lib/localVoice.js";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BASE64_CHARS = Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 32;
const allowedMimeTypes = new Set(["audio/webm", "audio/webm;codecs=opus", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"]);
const requests = new Map<string, { count: number; resetAt: number }>();

function cors(request: VercelRequest, response: VercelResponse) {
  const origin = request.headers.origin;
  if (origin && !isAllowedEndoBotOrigin(origin)) return false;
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return true;
}

function clientKey(request: VercelRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
}

function withinLimit(key: string) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

function mimeExtension(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

function publicEndoBotUrl() {
  if (process.env.ENDOBOT_PUBLIC_URL) return `${process.env.ENDOBOT_PUBLIC_URL.replace(/\/$/, "")}/api/endobot`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/endobot`;
  if (process.env.FRONTEND_ORIGIN?.includes("/api")) return process.env.FRONTEND_ORIGIN;
  return "http://127.0.0.1:3000/api/endobot";
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!cors(request, response)) return response.status(403).json({ error: "Origem não permitida." });
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method === "GET") return response.status(200).json(await getLocalVoiceStatus());
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });
  if (!withinLimit(clientKey(request))) return response.status(429).json({ error: "Aguarde um minuto antes de usar o modo de voz novamente." });

  const body = request.body as { audioBase64?: unknown; mimeType?: unknown; preferredLanguage?: unknown; history?: unknown; conversationId?: unknown; generateAudio?: unknown; transcribeOnly?: unknown };
  const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.split(";")[0].toLowerCase() : "audio/webm";
  if (!audioBase64 || audioBase64.length > MAX_AUDIO_BASE64_CHARS || !allowedMimeTypes.has(mimeType)) {
    return response.status(400).json({ error: "Envie uma gravação curta em formato de áudio compatível." });
  }

  let audio: Buffer;
  try {
    audio = Buffer.from(audioBase64, "base64");
    if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error("audio-limit");
  } catch {
    return response.status(400).json({ error: "A gravação de áudio é inválida ou excede o limite." });
  }

  try {
    let question: string;
    if (process.env.ENDOBOT_ASR_PROVIDER === "openai") {
      const openAiKey = process.env.OPENAI_API_KEY_FALLBACK || process.env.OPENAI_API_KEY;
      if (!openAiKey) return response.status(503).json({ error: "A transcrição OpenAI foi escolhida, mas a chave não está configurada.", code: "asr_unavailable" });
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `endobot.${mimeExtension(mimeType)}`);
      form.append("model", process.env.OPENAI_ASR_MODEL || "gpt-4o-mini-transcribe");
      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${openAiKey}` }, body: form, signal: AbortSignal.timeout(60_000),
      });
      const transcriptionPayload = await transcriptionResponse.json().catch(() => null) as { text?: unknown } | null;
      question = typeof transcriptionPayload?.text === "string" ? transcriptionPayload.text.trim() : "";
      if (!transcriptionResponse.ok || !question || question.length > 700) return response.status(422).json({ error: "Não foi possível entender uma pergunta curta na gravação." });
    } else {
      question = await transcribeLocalAudio(audio, mimeType, mimeExtension(mimeType));
    }

    if (body.transcribeOnly === true) {
      return response.status(200).json({ transcript: question });
    }

    const endoBotUrl = publicEndoBotUrl();
    if (!endoBotUrl) return response.status(503).json({ error: "O servidor do EndoBot não está configurado para voz." });
    const forwardedAuthorization = request.headers.authorization;
    const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (forwardedAuthorization) chatHeaders.Authorization = forwardedAuthorization;
    const chatResponse = await fetch(endoBotUrl, { method: "POST", headers: chatHeaders, body: JSON.stringify({ question, history: body.history, preferredLanguage: body.preferredLanguage, conversationId: body.conversationId }), signal: AbortSignal.timeout(150_000) });
    const chatPayload = await chatResponse.json().catch(() => null) as { answer?: unknown; error?: string; code?: string; redacted?: boolean; securityAction?: string } | null;
    if (!chatResponse.ok || typeof chatPayload?.answer !== "string") return response.status(chatResponse.status || 503).json(chatPayload ?? { error: "Não foi possível obter uma resposta." });
    const answer = chatPayload.answer.slice(0, 6000);

    if (body.generateAudio === false) {
      return response.status(200).json({ answer, transcript: question, redacted: Boolean(chatPayload.redacted), securityAction: chatPayload.securityAction, audioBase64: null, audioMimeType: "audio/wav" });
    }

    try {
      const speech = await synthesizeLocalSpeech(answer, typeof body.preferredLanguage === "string" ? body.preferredLanguage : "pt");
      return response.status(200).json({ answer, transcript: question, redacted: Boolean(chatPayload.redacted), securityAction: chatPayload.securityAction, ...speech });
    } catch (error) {
      const audioError = error instanceof LocalVoiceError ? error.message : "Não foi possível preparar o áudio do OmniVoice.";
      return response.status(200).json({ answer, transcript: question, redacted: Boolean(chatPayload.redacted), securityAction: chatPayload.securityAction, audioBase64: null, audioMimeType: "audio/wav", audioError });
    }
  } catch (error) {
    if (error instanceof LocalVoiceError) return response.status(error.status).json({ error: error.message, code: error.code });
    console.error("[EndoBot Voice] Falha transitória", error instanceof Error ? error.name : "erro desconhecido");
    return response.status(503).json({ error: "O modo de voz está temporariamente indisponível. Tente usar o chat textual." });
  }
}
