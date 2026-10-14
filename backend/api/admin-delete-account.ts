import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUserId } from "../lib/supabaseAuth.js";
import { canDeleteManagedAccount } from "../lib/adminAccountAction.js";
import { canDeleteAccounts, type StaffRole } from "../lib/staffPermissions.js";

function configureCors(request: VercelRequest, response: VercelResponse) {
  const origin = request.headers.origin;
  if (origin === "https://endo-acolhe.vercel.app") response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  configureCors(request, response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });
  if (request.headers.origin !== "https://endo-acolhe.vercel.app") return response.status(403).json({ error: "Origem não autorizada." });

  const projectUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRole) return response.status(500).json({ error: "Servidor não configurado." });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Autenticação necessária." });
  const actorId = await getSupabaseUserId(projectUrl, serviceRole, token);
  if (!actorId) return response.status(401).json({ error: "Sessão inválida." });

  const body = request.body as { targetUserId?: unknown };
  if (typeof body?.targetUserId !== "string" || !body.targetUserId) return response.status(400).json({ error: "Identificador de conta inválido." });
  const targetId = body.targetUserId;

  const supabase = createClient(projectUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: actorOwner, error: actorOwnerError }, { data: actorStaff, error: actorStaffError }, { data: targetAdmin, error: targetAdminError }, { data: adminAccess, error: adminAccessError }] = await Promise.all([
    supabase.from("endoacolhe_owners").select("user_id").eq("user_id", actorId).maybeSingle(),
    supabase.from("admin_users").select("role").eq("user_id", actorId).maybeSingle(),
    supabase.from("admin_users").select("user_id").eq("user_id", targetId).maybeSingle(),
    supabase.from("endoacolhe_admin_access_sessions").select("user_id").eq("user_id", actorId).gt("expires_at", new Date().toISOString()).maybeSingle(),
  ]);
  if (actorOwnerError || actorStaffError || adminAccessError) return response.status(500).json({ error: "Não foi possível verificar a permissão agora." });
  const actorRole: StaffRole = actorOwner ? "owner" : (actorStaff?.role as StaffRole | undefined) ?? null;
  if (!canDeleteAccounts(actorRole)) return response.status(403).json({ error: "Acesso restrito ao Dono e à equipe Admin." });
  if (!adminAccess) return response.status(403).json({ error: "Confirme a senha adicional do painel antes de realizar esta ação." });
  if (targetAdminError) return response.status(500).json({ error: "Não foi possível verificar a conta agora." });
  if (!canDeleteManagedAccount(actorId, targetId, Boolean(targetAdmin))) return response.status(400).json({ error: targetId === actorId ? "Administradoras não podem excluir a própria conta por este painel." : "Contas administrativas são gerenciadas fora deste painel." });

  const { error: deletionError } = await supabase.auth.admin.deleteUser(targetId);
  if (deletionError) return response.status(500).json({ error: "Não foi possível excluir a conta agora." });
  await supabase.from("account_deletion_actions").insert({ actor_user_id: actorId, deleted_user_id: targetId });
  return response.status(200).json({ ok: true });
}
