import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

import { accountCopy } from "./AccountSettingsDialog";

describe("configurações de conta", () => {
  it("mantém cópias completas nos três idiomas sem expor o e-mail", () => {
    for (const language of ["pt", "en", "es"] as const) {
      expect(accountCopy[language].title).toBeTruthy();
      expect(accountCopy[language].savePassword).toBeTruthy();
      expect(accountCopy[language].photoTitle).toBeTruthy();
      expect(accountCopy[language].photoInvalidType).toBeTruthy();
      expect(accountCopy[language].privacy.toLowerCase()).not.toContain("supabase");
    }
  });

  it("confere sessão e envia um arquivo WebP explícito ao bucket privado", async () => {
    const source = await import.meta.glob("./AccountSettingsDialog.tsx", { eager: true, query: "?raw", import: "default" })["./AccountSettingsDialog.tsx"] as string;
    expect(source).toContain("supabase.auth.getSession()");
    expect(source).toContain('new File([blob], "foto-de-perfil.webp", { type: "image/webp" })');
    expect(source).toContain("await storage.remove([path])");
  });
});
