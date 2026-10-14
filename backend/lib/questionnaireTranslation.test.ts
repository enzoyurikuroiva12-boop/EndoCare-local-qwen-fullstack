import { describe, expect, it } from "vitest";
import { parseQuestionnaireTranslationInput, parseQuestionnaireTranslationResponse, questionnaireTranslationPrompt } from "./questionnaireTranslation.js";

describe("tradução automática do Questionário", () => {
  it("normaliza apenas a pergunta e a orientação em português dentro dos limites", () => {
    expect(parseQuestionnaireTranslationInput({ promptPt: "  Como foi sua experiência?  ", helperPt: "  Conte com suas palavras. " })).toEqual({ promptPt: "Como foi sua experiência?", helperPt: "Conte com suas palavras." });
    expect(parseQuestionnaireTranslationInput({ promptPt: "   " })).toBeNull();
  });

  it("aceita somente JSON válido com perguntas nos dois idiomas", () => {
    expect(parseQuestionnaireTranslationResponse("```json\n{\"prompt_en\":\"How was it?\",\"prompt_es\":\"¿Cómo fue?\",\"helper_en\":\"Tell us\",\"helper_es\":\"Cuéntanos\"}\n```"))
      .toEqual({ promptEn: "How was it?", promptEs: "¿Cómo fue?", helperEn: "Tell us", helperEs: "Cuéntanos" });
    expect(parseQuestionnaireTranslationResponse("{\"prompt_en\":\"Only English\"}")).toBeNull();
  });

  it("instrui o tradutor a retornar somente campos de tradução", () => {
    const prompt = questionnaireTranslationPrompt({ promptPt: "Como foi sua experiência?", helperPt: "" });
    expect(prompt).toContain("exactly prompt_en, prompt_es, helper_en and helper_es");
    expect(prompt).toContain("Como foi sua experiência?");
  });
});
