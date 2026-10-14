import { describe, expect, it } from "vitest";
import { buildSignupLegalMetadata, legalVersions, publicLegalCopy } from "./legalContent";

describe("consentimento legal do cadastro", () => {
  it("envia os dois aceites, versões vigentes e origem web", () => {
    expect(buildSignupLegalMetadata("  Pessoa   Usuária ")).toEqual({
      name: "Pessoa Usuária",
      terms_accepted: true,
      privacy_accepted: true,
      terms_version: legalVersions.terms,
      privacy_version: legalVersions.privacy,
      consent_source: "web",
    });
  });

  it("mantém FAQ, Termos e Privacidade disponíveis nos três idiomas", () => {
    for (const language of ["pt", "en", "es"] as const) {
      expect(publicLegalCopy[language].faq.length).toBeGreaterThan(0);
      expect(publicLegalCopy[language].terms.length).toBeGreaterThan(0);
      expect(publicLegalCopy[language].privacy.length).toBeGreaterThan(0);
    }
  });
});
