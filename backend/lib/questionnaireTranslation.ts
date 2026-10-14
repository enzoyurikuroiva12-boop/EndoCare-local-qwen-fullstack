export const QUESTIONNAIRE_PROMPT_MAX_LENGTH = 300;
export const QUESTIONNAIRE_HELPER_MAX_LENGTH = 320;

export type QuestionnaireTranslationInput = {
  promptPt: string;
  helperPt: string;
};

export type QuestionnaireTranslationResult = {
  promptEn: string;
  promptEs: string;
  helperEn: string;
  helperEs: string;
};

function normalizeText(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximumLength) : "";
}

export function parseQuestionnaireTranslationInput(value: unknown): QuestionnaireTranslationInput | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { promptPt?: unknown; helperPt?: unknown };
  const promptPt = normalizeText(candidate.promptPt, QUESTIONNAIRE_PROMPT_MAX_LENGTH);
  const helperPt = normalizeText(candidate.helperPt, QUESTIONNAIRE_HELPER_MAX_LENGTH);
  return promptPt ? { promptPt, helperPt } : null;
}

function unwrapJson(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

export function parseQuestionnaireTranslationResponse(value: string | null): QuestionnaireTranslationResult | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(unwrapJson(value)) as Record<string, unknown>;
    const promptEn = normalizeText(parsed.prompt_en, QUESTIONNAIRE_PROMPT_MAX_LENGTH);
    const promptEs = normalizeText(parsed.prompt_es, QUESTIONNAIRE_PROMPT_MAX_LENGTH);
    const helperEn = normalizeText(parsed.helper_en, QUESTIONNAIRE_HELPER_MAX_LENGTH);
    const helperEs = normalizeText(parsed.helper_es, QUESTIONNAIRE_HELPER_MAX_LENGTH);
    return promptEn && promptEs ? { promptEn, promptEs, helperEn, helperEs } : null;
  } catch {
    return null;
  }
}

export function questionnaireTranslationPrompt({ promptPt, helperPt }: QuestionnaireTranslationInput) {
  return [
    "Translate a public experience-questionnaire item from Brazilian Portuguese into English and Spanish.",
    "Return only one valid JSON object with exactly prompt_en, prompt_es, helper_en and helper_es keys.",
    "Preserve the meaning, an inclusive and welcoming tone, punctuation and question form. Do not add medical advice, diagnoses, promises, explanations or markdown.",
    `Portuguese question: ${JSON.stringify(promptPt)}`,
    `Portuguese guidance: ${JSON.stringify(helperPt)}`,
  ].join("\n");
}
