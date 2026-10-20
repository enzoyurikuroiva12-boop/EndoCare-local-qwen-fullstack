import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTemporaryMessages, endoBotCopy } from "./EndoBotPanel";

describe("endoBotCopy", () => {
  it("fornece todos os textos auxiliares e categorias nos três idiomas", () => {
    expect(Object.keys(endoBotCopy).sort()).toEqual(["en", "es", "pt"]);

    for (const copy of Object.values(endoBotCopy)) {
      expect(copy.privateHistory).toBeTruthy();
      expect(copy.temporarySession).toBeTruthy();
      expect(copy.categories["Informações gerais"]).toBeTruthy();
      expect(copy.placeholder).toBeTruthy();
      expect(copy.enterHint).toBeTruthy();
      expect(copy.deleteConversation).toBeTruthy();
      expect(copy.available).toBeTruthy();
      expect(copy.unavailableStatus).toBeTruthy();
      expect(copy.serviceUnavailable).toBeTruthy();
      expect(copy.voiceLoading).toBeTruthy();
      expect(copy.voiceStatusUnavailable).toBeTruthy();
      expect(copy.microphonePermission).toBeTruthy();
      expect(copy.humanConsentTitle).toBeTruthy();
      expect(copy.humanConsentLabel).toBeTruthy();
      expect(copy.humanTeamTakenOver).toBeTruthy();
      expect(copy.humanTeam).toBeTruthy();
      expect(copy.suggestions).toHaveLength(3);
    }
  });

  it("mantém o estado offline claramente localizado e desabilita o envio por cópia", () => {
    expect(endoBotCopy.pt.unavailableStatus).toBe("Indisponível");
    expect(endoBotCopy.pt.serviceUnavailable).toContain("envio de mensagens foi desabilitado");
    expect(endoBotCopy.en.unavailableStatus).toBe("Unavailable");
    expect(endoBotCopy.es.unavailableStatus).toBe("No disponible");
  });

  it("reinicia a sessão temporária sem reutilizar mensagens e adapta a saudação ao idioma", () => {
    const portuguese = createTemporaryMessages("pt");
    portuguese.push({ role: "user", content: "mensagem temporária" });

    const english = createTemporaryMessages("en");
    const spanish = createTemporaryMessages("es");

    expect(english).toHaveLength(1);
    expect(spanish).toHaveLength(1);
    expect(english[0]?.content).toContain("Hello");
    expect(spanish[0]?.content).toContain("Hola");
    expect(english.some((message) => message.content.includes("mensagem temporária"))).toBe(false);
  });

  it("usa aviso transparente sem checkbox e mantém a opção de revogar o acompanhamento", async () => {
    expect(endoBotCopy.pt.humanConsentDescription).toContain("suporte e segurança");
    expect(endoBotCopy.en.humanConsentDescription).toContain("support and safety");
    expect(endoBotCopy.es.humanConsentDescription).toContain("soporte y seguridad");
    expect(endoBotCopy.pt.humanTeam).toContain("Equipe humana");

    const source = await readFile(resolve(process.cwd(), "client/src/components/EndoBotPanel.tsx"), "utf8");
    expect(source).toContain("humanReviewConsent, setHumanReviewConsent] = useState(true)");
    expect(source).toContain("Transparência do acompanhamento humano");
    expect(source).toContain("activeConversationId && humanReviewConsent");
    expect(source).not.toContain('type="checkbox"');
  });
});
