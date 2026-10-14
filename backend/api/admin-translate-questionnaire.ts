import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getOpenRouterAnswer, getOpenRouterEndpoint, getOpenRouterModel } from "../lib/openrouter.js";
import { getSupabaseUserId } from "../lib/supabaseAuth.js";
import { parseQuestionnaireTranslationInput, parseQuestionnaireTranslationResponse, questionnaireTranslationPrompt } from "../lib/questionnaireTranslation.js";

const allowedOrigin = "https://endo-acolhe.vercel.app";
const rateWindowMs = 5 * 60 * 1000;
const rateLimit = 12;
const translationRate = new Map<string, { count: number; resetAt: number }>();

function configureCors(request: VercelRequest, response: VercelResponse) {
  if (request.headers.origin === allowedOrigin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function withinRateLimit(actorId: string) {
  const now = Date.now();
  const current = translationRate.get(actorId);
  if (!current || current.resetAt <= now) {
    translationRate.set(actorId, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }
  if (current.count >= rateLimit) return false;
  current.count += 1;
  return true;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  configureCors(request, response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });
  if (request.headers.origin !== allowedOrigin) return response.status(403).json({ error: "Origem não autorizada." });

  const projectUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!projectUrl || !serviceRole || !openRouterKey) return response.status(503).json({ error: "A tradução automática está indisponível agora." });

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Autenticação necessária." });
  const actorId = await getSupabaseUserId(projectUrl, serviceRole, token);
  if (!actorId) return response.status(401).json({ error: "Sessão inválida." });
  if (!withinRateLimit(actorId)) return response.status(429).json({ error: "Aguarde alguns minutos antes de gerar outra tradução." });

  const input = parseQuestionnaireTranslationInput(request.body);
  if (!input) return response.status(400).json({ error: "Escreva uma pergunta em português para continuar." });

  const supabase = createClient(projectUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: owner, error: ownerError }, { data: staff, error: staffError }, { data: adminAccess, error: gateError }] = await Promise.all([
    supabase.from("endoacolhe_owners").select("user_id").eq("user_id", actorId).maybeSingle(),
    supabase.from("admin_users").select("role").eq("user_id", actorId).maybeSingle(),
    supabase.from("endoacolhe_admin_access_sessions").select("user_id").eq("user_id", actorId).gt("expires_at", new Date().toISOString()).maybeSingle(),
  ]);
  if (ownerError || staffError || gateError) return response.status(500).json({ error: "Não foi possível confirmar a permissão agora." });
  const canManage = Boolean(owner) || staff?.role === "admin";
  if (!canManage) return response.status(403).json({ error: "Você não tem permissão para gerenciar perguntas." });
  if (!adminAccess) return response.status(403).json({ error: "Confirme a senha adicional do painel antes de traduzir a pergunta." });

  try {
    const upstream = await fetch(getOpenRouterEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "HTTP-Referer": process.env.FRONTEND_ORIGIN || allowedOrigin, "X-OpenRouter-Title": "EndoAcolhe Questionnaire" },
      body: JSON.stringify({ model: getOpenRouterModel(process.env.QUESTIONNAIRE_TRANSLATION_MODEL), reasoning: { enabled: false }, temperature: 0, max_tokens: 700, messages: [{ role: "system", content: "You are a translation service. Follow the requested JSON schema exactly." }, { role: "user", content: questionnaireTranslationPrompt(input) }] }),
    });
    if (!upstream.ok) return response.status(503).json({ error: "A tradução automática está indisponível agora. Tente novamente em instantes." });
    const translation = parseQuestionnaireTranslationResponse(getOpenRouterAnswer(await upstream.json()));
    if (!translation) return response.status(503).json({ error: "Não foi possível gerar traduções válidas agora. Tente novamente." });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json(translation);
  } catch {
    return response.status(503).json({ error: "A tradução automática está indisponível agora. Tente novamente em instantes." });
  }
}
