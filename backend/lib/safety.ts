export const forbiddenPattern = /\b(pdf|arquivo|documento|upload|anex[oa]|rag|base de conhecimento)\b/i;
export const injectionPattern = /ignore\s+(as\s+)?instru|reveal\s+(the\s+)?prompt|system\s+prompt|ignore\s+previous/i;
const privatePatterns = [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, /\b\+?\d{1,3}[\s.-]?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g, /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g];

export function sanitizeQuestion(value: string) {
  let content = value;
  let redacted = false;
  for (const pattern of privatePatterns) content = content.replace(pattern, () => { redacted = true; return "[dado removido]"; });
  return { content, redacted };
}

export function blockedAnswer() {
  return "Posso ajudar com informações gerais sobre endometriose e como organizar perguntas para seu atendimento.";
}
