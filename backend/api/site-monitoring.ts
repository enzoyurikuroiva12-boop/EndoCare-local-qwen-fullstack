import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isAllowedSiteMonitoringOrigin } from "../lib/cors.js";
import { parseSiteMonitoringPayload } from "../lib/siteMonitoring.js";

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function configureCors(request: VercelRequest, response: VercelResponse) {
  const origin = request.headers.origin;
  if (origin && isAllowedSiteMonitoringOrigin(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function requestFingerprint(request: VercelRequest, secret: string) {
  const forwarded = request.headers["x-forwarded-for"];
  const address = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
  return createHash("sha256").update(`${secret}:${address}`).digest("hex").slice(0, 40);
}

function withinLimit(key: string) {
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || current.resetAt < now) { requestBuckets.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  configureCors(request, response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST" || !isAllowedSiteMonitoringOrigin(request.headers.origin)) return response.status(405).json({ error: "Método ou origem não permitidos." });
  const projectUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRole) return response.status(500).json({ error: "Servidor não configurado." });
  if (!withinLimit(requestFingerprint(request, process.env.SITE_MONITORING_RATE_SECRET || serviceRole))) return response.status(429).json({ error: "Muitas solicitações de telemetria." });
  const payload = parseSiteMonitoringPayload(request.body);
  if (!payload) return response.status(400).json({ error: "Evento de telemetria inválido." });
  const supabase = createClient(projectUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from("site_monitoring_events").upsert(
    { event_type: payload.eventType, route_path: payload.path, session_id: payload.sessionId, locale: payload.locale, viewport: payload.viewport },
    { onConflict: "event_type,route_path,session_id", ignoreDuplicates: true },
  );
  if (error) return response.status(500).json({ error: "Não foi possível registrar o evento." });
  return response.status(204).end();
}
