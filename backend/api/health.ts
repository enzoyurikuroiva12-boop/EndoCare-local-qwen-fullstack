import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { getNvidiaEndpoint, getNvidiaModelsEndpoint } from "../lib/nvidia.js";
import { isAllowedEndoBotOrigin } from "../lib/cors.js";
import { isOllamaModelAvailable } from "../lib/ollama.js";
import { createTimedFetch } from "../lib/upstreamResilience.js";

const healthRequests = new Map<string, { count: number; resetAt: number }>();
const MAX_HEALTH_RATE_LIMIT_KEYS = 5_000;

function requestFingerprint(request: VercelRequest) {
  const forwarded = request.headers["x-forwarded-for"];
  const address = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
  return createHash("sha256").update(address).digest("hex").slice(0, 32);
}

function withinHealthLimit(request: VercelRequest) {
  const key = requestFingerprint(request);
  const now = Date.now();
  if (healthRequests.size >= MAX_HEALTH_RATE_LIMIT_KEYS) {
    for (const [entryKey, entry] of healthRequests) if (entry.resetAt <= now) healthRequests.delete(entryKey);
    if (healthRequests.size >= MAX_HEALTH_RATE_LIMIT_KEYS) return false;
  }
  const current = healthRequests.get(key);
  if (!current || current.resetAt <= now) {
    healthRequests.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

async function providerIsReachable(url: string, key: string) {
  try {
    const upstream = await createTimedFetch(4_000)(url, { headers: { Authorization: `Bearer ${key}` } });
    return upstream.ok;
  } catch {
    return false;
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const origin = request.headers.origin;
  if (origin && !isAllowedEndoBotOrigin(origin)) return response.status(403).json({ status: "unavailable", service: "endobot" });
  if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ status: "unavailable" });
  if (!withinHealthLimit(request)) return response.status(429).json({ status: "unavailable", service: "endobot" });

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openAiFallbackKey = process.env.OPENAI_API_KEY_FALLBACK;
  const ollamaEnabled = process.env.OLLAMA_ENABLED !== "false";
  const checks: Promise<boolean>[] = [];
  if (openRouterKey) checks.push(providerIsReachable("https://openrouter.ai/api/v1/models", openRouterKey));
  if (nvidiaKey) checks.push(providerIsReachable(`${getNvidiaModelsEndpoint(process.env.NVIDIA_UPSTREAM_URL)}`, nvidiaKey));
  if (openAiFallbackKey) checks.push(providerIsReachable(process.env.OPENAI_CHAT_ENDPOINT ? new URL(process.env.OPENAI_CHAT_ENDPOINT).origin + "/v1/models" : "https://api.openai.com/v1/models", openAiFallbackKey));
  if (ollamaEnabled) checks.push(isOllamaModelAvailable(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434", process.env.OLLAMA_MODEL || "qwen2.5:3b"));
  if (!checks.length) return response.status(503).json({ status: "maintenance", service: "endobot" });

  const reachable = await Promise.all(checks);
  if (reachable.some(Boolean)) return response.status(200).json({ status: "ok", service: "endobot" });
  return response.status(503).json({ status: "unavailable", service: "endobot" });
}
