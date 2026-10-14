export type BotLanguage = "pt" | "en" | "es";

const allowedLanguages = new Set<BotLanguage>(["pt", "en", "es"]);

export function normalizeLanguage(value: unknown): BotLanguage {
  return typeof value === "string" && allowedLanguages.has(value as BotLanguage) ? value as BotLanguage : "pt";
}

export function detectLanguage(message: string, preferred: unknown): BotLanguage {
  const content = message.toLocaleLowerCase("en-US");
  if (/\b(the|and|with|what|how|about|please|symptoms|appointment|pain)\b/.test(content)) return "en";
  if (/[¿¡]|\b(hola|gracias|puedo|consulta|dolor|síntomas|endometriosis|necesito)\b/.test(content)) return "es";
  return normalizeLanguage(preferred);
}

export function responseLanguageInstruction(language: BotLanguage) {
  if (language === "en") return "Reply only in clear, empathetic English.";
  if (language === "es") return "Responde solamente en español claro y empático.";
  return "Responda somente em português brasileiro, com clareza e empatia.";
}
