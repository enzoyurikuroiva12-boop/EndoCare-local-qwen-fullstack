import { describe, expect, it } from "vitest";
import { initialBotMessage, languageName } from "./endoBotLanguage";

describe("idiomas do EndoBot", () => {
  it("fornece a saudação em português por padrão", () => {
    expect(initialBotMessage("pt").content).toContain("Olá");
  });

  it("fornece rótulos e saudações em inglês e espanhol", () => {
    expect(languageName("en")).toBe("English");
    expect(initialBotMessage("es").content).toContain("Hola");
  });
});
