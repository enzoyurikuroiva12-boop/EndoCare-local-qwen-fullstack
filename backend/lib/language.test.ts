import { describe, expect, it } from "vitest";
import { detectLanguage, normalizeLanguage, responseLanguageInstruction } from "./language.js";

describe("idioma do EndoBot", () => {
  it("mantém a preferência quando não encontra marcador inequívoco", () => {
    expect(detectLanguage("Quero saber mais", "pt")).toBe("pt");
    expect(normalizeLanguage("fr")).toBe("pt");
  });

  it("detecta inglês e espanhol na pergunta recebida", () => {
    expect(detectLanguage("What symptoms should I discuss?", "pt")).toBe("en");
    expect(detectLanguage("¿Cómo preparo preguntas para mi consulta?", "en")).toBe("es");
  });

  it("constrói a instrução de resposta no idioma detectado", () => {
    expect(responseLanguageInstruction("en")).toContain("English");
  });
});
