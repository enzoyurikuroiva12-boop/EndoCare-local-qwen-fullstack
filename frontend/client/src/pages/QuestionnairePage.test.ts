import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "client/src/pages/QuestionnairePage.tsx"), "utf8");
const questionnaireSource = readFileSync(resolve(process.cwd(), "client/src/components/Questionnaire.tsx"), "utf8");

describe("página própria do questionário", () => {
  it("registra a rota pública sem expor o questionário dentro da Home", () => {
    expect(appSource).toContain('<Route path="/questionario" component={QuestionnairePage} />');
    expect(homeSource).toContain('navigateWithTransition("/questionario")');
    expect(homeSource).not.toContain('import Questionnaire from "@/components/Questionnaire"');
    expect(homeSource).not.toContain("<Questionnaire />");
  });

  it("mantém o fluxo de respostas, avaliação e avisos responsáveis", () => {
    expect(pageSource).toContain("site-root questionnaire-page");
    expect(pageSource).toContain("className=\"is-current\" aria-current=\"page\"");
    expect(questionnaireSource).toContain("p_rating: rating");
    expect(questionnaireSource).toContain("Array.from({ length: 5 }");
    expect(questionnaireSource).toContain("Não informe nomes, e-mails, diagnósticos");
  });

  it("vincula o envio à conta e comunica o limite semanal", () => {
    expect(questionnaireSource).toContain("get_endoacolhe_questionnaire_status");
    expect(questionnaireSource).toContain("weeklyLimitLocked");
    expect(questionnaireSource).toContain("startLogin");
    expect(questionnaireSource).toContain("disabled={!isAuthenticated");
  });
});
