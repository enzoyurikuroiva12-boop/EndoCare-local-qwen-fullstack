import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAllowedEndoBotOrigin } from "../lib/cors.js";
import { LocalVoiceError, synthesizeLocalSpeech } from "../lib/localVoice.js";

const requests = new Map<string, { count: number; resetAt: number }>();

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const origin = request.headers.origin;
  if (origin && !isAllowedEndoBotOrigin(origin)) return response.status(403).json({ error: "Origem não permitida." });
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = requests.get(key);
  if (current && current.resetAt > now && current.count >= 12) return response.status(429).json({ error: "Aguarde um minuto antes de ouvir mais respostas.", code: "tts_rate_limit" });
  if (!current || current.resetAt <= now) requests.set(key, { count: 1, resetAt: now + 60_000 });
  else current.count += 1;
  // Expire entries so the limit does not grow with every new visitor.
  for (const [address, entry] of requests) if (entry.resetAt <= now) requests.delete(address);
  const body = request.body as { text?: unknown; preferredLanguage?: unknown } | undefined;
  if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 6000) {
    return response.status(400).json({ error: "Informe um texto curto para ouvir.", code: "invalid_text" });
  }
  try {
    const speech = await synthesizeLocalSpeech(body.text, typeof body.preferredLanguage === "string" ? body.preferredLanguage : "pt");
    return response.status(200).json(speech);
  } catch (error) {
    const failure = error instanceof LocalVoiceError ? error : new LocalVoiceError("A voz está indisponível no momento.");
    return response.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}
