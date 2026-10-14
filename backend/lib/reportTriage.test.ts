import { describe, expect, it } from "vitest";
import { mergeReportTriage, parseModelJson, runDeterministicReportChecks } from "./reportTriage.js";

describe("triagem de relatos", () => {
  it("sinaliza repetição evidente como provável spam sem chamar a IA", () => {
    expect(runDeterministicReportChecks("Pessoa", "!!!!!!!!!!!!!!!!!")).toMatchObject({ label: "likely_spam" });
  });

  it("não trata relato emocional ou com erro de escrita como troll por regra fixa", () => {
    expect(runDeterministicReportChecks("Ana", "Foi difícil e fiquei muito cansada, mas consegui organizar minhas perguntas para a consulta.")).toMatchObject({ label: "adequate" });
  });

  it("mantém revisão humana quando a IA não responde", () => {
    expect(mergeReportTriage(runDeterministicReportChecks("Ana", "Tive uma experiência pessoal e quero compartilhar o que aconteceu comigo."), null)).toMatchObject({ label: "needs_review", signals: ["ai_check_unavailable"] });
  });

  it("aceita somente JSON estruturado com rótulo permitido", () => {
    expect(parseModelJson("{\"label\":\"needs_review\",\"confidence\":0.8,\"reasons\":[\"fora do propósito\"]}")).toEqual({ label: "needs_review", confidence: 0.8, reasons: ["fora do propósito"] });
    expect(parseModelJson("{\"label\":\"reject_user\",\"confidence\":1,\"reasons\":[]}")).toBeNull();
  });
});
