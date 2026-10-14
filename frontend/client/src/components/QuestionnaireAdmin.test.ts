import { describe, expect, it } from "vitest";

describe("QuestionnaireAdmin", () => {
  it("mantém somente a edição em português e delega a tradução ao endpoint administrativo", async () => {
    const source = await import.meta.glob("./QuestionnaireAdmin.tsx", { eager: true, query: "?raw", import: "default" })["./QuestionnaireAdmin.tsx"] as string;
    expect(source).toContain("admin-translate-questionnaire");
    expect(source).toContain("createTranslations(sourceQuestion, sourceHelper)");
    expect(source).toContain("body: JSON.stringify({ promptPt, helperPt })");
    expect(source).not.toContain('updateForm("prompt_en"');
    expect(source).not.toContain('updateForm("prompt_es"');
    expect(source).not.toContain('updateForm("helper_en"');
    expect(source).not.toContain('updateForm("helper_es"');
  });

  it("oferece exclusão confirmada e mantém a ação no escopo das perguntas", async () => {
    const source = await import.meta.glob("./QuestionnaireAdmin.tsx", { eager: true, query: "?raw", import: "default" })["./QuestionnaireAdmin.tsx"] as string;
    expect(source).toContain("deleteQuestion");
    expect(source).toContain('from("endoacolhe_questionnaire_questions").delete()');
    expect(source).toContain("AlertDialog");
    expect(source).toContain("deleteTarget");
    expect(source).toContain("t.deleteConfirm");
  });
});
