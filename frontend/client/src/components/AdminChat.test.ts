import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), channel: vi.fn() } }));

import { canDeleteAdminChatMessage, extractAdminChatMentionIds, normalizeAdminChatHandle, type AdminChatMember } from "./AdminChat";

const members: AdminChatMember[] = [
  { user_id: "owner-id", display_name: "Ana Clara" },
  { user_id: "admin-id", display_name: "João Lima" },
  { user_id: "support-id", display_name: "Bia_Suporte" },
];

describe("AdminChat", () => {
  it("normaliza o nome para um identificador de menção estável", () => {
    expect(normalizeAdminChatHandle("João Lima")).toBe("joaolima");
    expect(normalizeAdminChatHandle("Bia_Suporte")).toBe("biasuporte");
  });

  it("resolve somente menções de administradores conhecidos", () => {
    expect(extractAdminChatMentionIds("Oi @AnaClara e @joao-lima, veja isso.", members)).toEqual(["owner-id", "admin-id"]);
    expect(extractAdminChatMentionIds("@desconhecida não deve virar destinatária.", members)).toEqual([]);
  });

  it("remove menções repetidas e ignora e-mail ou texto interno", () => {
    expect(extractAdminChatMentionIds("@AnaClara @anaclara ana@example.com @Bia_Suporte", members)).toEqual(["owner-id", "support-id"]);
  });

  it("permite apagar somente a própria mensagem, exceto para o Dono", () => {
    expect(canDeleteAdminChatMessage("admin-id", "admin-id", false)).toBe(true);
    expect(canDeleteAdminChatMessage("owner-id", "admin-id", false)).toBe(false);
    expect(canDeleteAdminChatMessage("owner-id", "admin-id", true)).toBe(true);
  });
});
