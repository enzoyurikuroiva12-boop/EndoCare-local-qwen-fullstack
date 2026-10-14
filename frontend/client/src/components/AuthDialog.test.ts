import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

import { authCopy } from "./AuthDialog";

describe("authCopy", () => {
  it("fornece textos de login com e-mail e senha nos três idiomas globais", () => {
    expect(Object.keys(authCopy).sort()).toEqual(["en", "es", "pt"]);

    for (const copy of Object.values(authCopy)) {
      expect(copy.loginTitle).toBeTruthy();
      expect(copy.loginIntro).toBeTruthy();
      expect(copy.loginFailure).toMatch(/senha|password|contraseña/i);
      expect(copy.email).toBeTruthy();
      expect(copy.password).toBeTruthy();
      expect(copy.passwordPlaceholder).toBeTruthy();
      expect(copy.signIn).toBeTruthy();
      expect(copy.linkTitle).toBeTruthy();
      expect(copy.linkInstruction).toBeTruthy();
      expect(copy.forgotPassword).toBeTruthy();
      expect(copy.recoveryAction).toBeTruthy();
      expect(copy.passwordInvalid).toBeTruthy();
      expect("loginLinkTitle" in copy).toBe(false);
      expect("loginLinkIntro" in copy).toBe(false);
      expect("loginLinkInstruction" in copy).toBe(false);
      expect("google" in copy).toBe(false);
      expect(copy.linkIntro("person@example.com")).toContain("person@example.com");
      expect(copy.signupSuccess).toBeTruthy();
      expect(copy.resendLink).toBeTruthy();
      expect(copy.wait(5)).toContain("5");
    }
  });
});
