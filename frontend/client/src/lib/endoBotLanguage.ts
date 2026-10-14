export type BotLanguage = "pt" | "en" | "es";

export const botLanguages: Array<{ value: BotLanguage; label: string }> = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function initialBotMessage(language: BotLanguage) {
  if (language === "en") return { role: "assistant" as const, content: "Hello. I can explain general information about endometriosis and help you organize questions for an appointment. Please avoid sharing personal information." };
  if (language === "es") return { role: "assistant" as const, content: "Hola. Puedo explicar información general sobre endometriosis y ayudarte a organizar preguntas para una consulta. Evita compartir datos personales." };
  return { role: "assistant" as const, content: "Olá. Posso explicar informações gerais sobre endometriose e ajudar você a organizar perguntas para o atendimento. Evite incluir dados pessoais." };
}

export function languageName(language: BotLanguage) {
  return botLanguages.find(item => item.value === language)?.label ?? "Português";
}
