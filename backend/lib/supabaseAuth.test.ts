import { describe, expect, it, vi } from "vitest";
import { getSupabaseUserId, isSupabaseAccountActive } from "./supabaseAuth.js";

describe("validação de sessão Supabase", () => {
  it("consulta o endpoint autenticado e retorna somente um id de usuário válido", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "user-123" }) });
    await expect(getSupabaseUserId("https://projeto.supabase.co", "service-key", "user-token", fetcher)).resolves.toBe("user-123");
    expect(fetcher).toHaveBeenCalledWith("https://projeto.supabase.co/auth/v1/user", {
      headers: { apikey: "service-key", Authorization: "Bearer user-token" },
    });
  });

  it("recusa token inválido, resposta sem id e falha de rede", async () => {
    await expect(getSupabaseUserId("https://projeto.supabase.co", "service-key", "bad-token", async () => ({ ok: false, json: async () => ({}) }))).resolves.toBeNull();
    await expect(getSupabaseUserId("https://projeto.supabase.co", "service-key", "bad-token", async () => { throw new Error("offline"); })).resolves.toBeNull();
  });

  it("consulta o estado de conta com o token da pessoa autenticada e falha de forma fechada", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => true });
    await expect(isSupabaseAccountActive("https://projeto.supabase.co", "service-key", "user-token", fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://projeto.supabase.co/rest/v1/rpc/is_endoacolhe_account_active", {
      method: "POST",
      headers: { apikey: "service-key", Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: "{}",
    });
    await expect(isSupabaseAccountActive("https://projeto.supabase.co", "service-key", "user-token", async () => ({ ok: false, json: async () => false }))).resolves.toBe(false);
  });
});
