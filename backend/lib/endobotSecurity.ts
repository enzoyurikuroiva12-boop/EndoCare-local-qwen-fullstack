import { createHash, createHmac } from "node:crypto";

export const ENDOBOT_SECURITY_WINDOW_MS = 15 * 60_000;
export const ENDOBOT_SUSPENSION_MS = 24 * 60 * 60_000;

export type EndoBotSecuritySignal =
  | "credential_request"
  | "instruction_override"
  | "prompt_disclosure"
  | "role_hijack"
  | "tool_execution"
  | "fault_injection"
  | "data_exfiltration"
  | "destructive_command"
  | "secret_material"
  | "obfuscation"
  | "output_leakage";
export type EndoBotSecuritySource = "input" | "output";
export type EndoBotThreatCategory = "credential_access" | "prompt_injection" | "fault_injection" | "data_exfiltration" | "destructive_request" | "sensitive_disclosure";
export type EndoBotThreatSeverity = "medium" | "high" | "critical";

const securityPatterns: Array<{ signal: EndoBotSecuritySignal; pattern: RegExp }> = [
  { signal: "instruction_override", pattern: /\b(?:ignore|disregard|bypass|override|desconsidere|ignora|ignorar|desconsidera|ignore|pule)\b.{0,90}\b(?:all\s+)?(?:previous|prior|system|safety|rules?|instructions?|instruções?|regras?|segurança|indicaciones?|anteriores?)\b/i },
  { signal: "prompt_disclosure", pattern: /(?:\b(?:reveal|show|print|repeat|display|tell\s+me|mostrar|exibir|revele|revelar|repetir|mostre|diga)\b.{0,80}\b(?:system|sistema|developer|desenvolvedor|hidden|oculto|internal|interno)?\s*(?:prompt|instructions?|instruções?|mensagem|message)\b|\b(?:system|sistema|developer|desenvolvedor|hidden|oculto|internal|interno)\s+(?:prompt|instructions?|instruções?|mensagem|message)\b)/i },
  { signal: "role_hijack", pattern: /\b(?:act\s+as|you\s+are\s+now|developer\s+mode|jailbreak|finja\s+ser|você\s+agora\s+é|modo\s+desenvolvedor|eres\s+ahora|modo\s+desarrollador)\b/i },
  { signal: "tool_execution", pattern: /\b(?:run|execute|execute|rodar|rode|executar|ejecuta)\b.{0,64}\b(?:command|comando|shell|terminal|bash|curl|sql|query|consulta|psql|supabase|script)\b/i },
  { signal: "fault_injection", pattern: /\b(?:fault\s+injection|error\s+injection|chaos\s+injection|injeção\s+de\s+falha|injeção\s+de\s+erro|simular\s+falha|forçar\s+falha|force\s+failure|inject\s+fault|corrupt\s+(?:the\s+)?database|corromper\s+(?:o\s+)?banco)\b/i },
  { signal: "data_exfiltration", pattern: /\b(?:exfiltrat\w*|dump|export\w*|steal|extract|download|send|copy|vaz\w*|roub\w*|extra\w*|baix\w*|envi\w*|copi\w*)\b.{0,90}\b(?:all|every|database|db|records?|users?|emails?|data|dados|banco|tabelas?|todas?|todos?|usuári\w*|e-?mails?|registros?)\b/i },
  { signal: "destructive_command", pattern: /(?:\b(?:drop|truncate|delete|erase|wipe|destroy|remove)\b.{0,80}\b(?:database|db|table|tables|all|users?|data|banco|tabela|todas?|todos?|usuári\w*|dados)\b|\b(?:rm\s+-rf|delete\s+from|truncate\s+table|drop\s+(?:database|table)|apague\s+tudo|exclua\s+tudo|apagar\s+o\s+banco|deletar\s+usuári\w*)\b)/i },
  { signal: "obfuscation", pattern: /\b(?:base64|base\s*64|rot13|hex(?:adecimal)?|unicode|codifique|codificar|decodifique|decodificar|decode)\b.{0,100}\b(?:prompt|instruções?|chave|key|token|segredo|secret|comando|sql|system|sistema)\b/i },
];

const credentialRequestPattern = /(?:\b(?:reveal|show|print|give|send|provide|return|list|display|tell|expose|extract|copy|share|where\s+is|mostrar|mostre|exibir|revele|revelar|forneça|envie|diga|qual\s+(?:é|e)|me\s+dê|obter|extraia|copie|compartilhe)(?=\s|$).{0,100}\b(?:api[\s_-]?key|api[\s_-]?token|access[\s_-]?token|secret(?:[\s_-]?key)?|chave(?:\s+de)?\s+api|token(?:\s+de\s+acesso)?|service[\s_-]?role|password|senha|vari[aá]vel(?:\s+de)?\s+ambiente|environment\s+variable|env(?:ironment)?[\s_-]?var)\b|\b(?:my|your|our|the|meu|minha|seu|sua|nosso|nossa|a\s+minha|a\s+minha|a\s+do\s+sistema)\s+(?:api[\s_-]?key|api[\s_-]?token|access[\s_-]?token|secret(?:[\s_-]?key)?|chave(?:\s+de)?\s+api|token(?:\s+de\s+acesso)?|service[\s_-]?role|password|senha|vari[aá]vel(?:\s+de)?\s+ambiente|environment\s+variable|env(?:ironment)?[\s_-]?var)\b.{0,100}\b(?:reveal|show|print|give|send|provide|return|list|display|tell|expose|extract|copy|share|mostrar|exibir|revele|revelar|forneça|envie|diga|obter|extraia|copie|compartilhe|qual\s+(?:é|e)|me\s+dê)(?=\s|$))/i;
const secretMaterialPattern = /\b(?:sk-(?:proj-)?[a-z0-9_-]{16,}|sk-ant-[a-z0-9_-]{16,}|ghp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|xox[baprs]-[a-z0-9-]{20,}|AIza[a-z0-9_-]{20,}|eyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,})\b/i;
const inlineSecretPattern = /\b(?:api[\s_-]?key|api[\s_-]?token|access[\s_-]?token|secret[\s_-]?key|service[\s_-]?role|supabase[_\s-]+service[_\s-]+role|openrouter[_\s-]+api[_\s-]+key|password|senha|token)\b\s*[:=]\s*[^\s,;]{8,}/i;
const outputLeakagePattern = /(?:\b(?:api[\s_-]?key|api[\s_-]?token|access[\s_-]?token|secret[\s_-]?key|service[\s_-]?role|supabase[_\s-]+service[_\s-]+role|openrouter[_\s-]+api[_\s-]+key|password|senha)\b\s*[:=]\s*\S+|\b(?:system|developer|internal|hidden)\s+(?:prompt|instructions?|instruções?|message|mensagem)\b|\b(?:BEGIN|START)\s+(?:SYSTEM|DEVELOPER)\s+(?:PROMPT|INSTRUCTIONS)\b)/i;

function normalizeSecurityText(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}

function uniqueSignals(signals: EndoBotSecuritySignal[]) {
  return [...new Set(signals)];
}

export type EndoBotHistoryMessage = { role: "user" | "assistant"; content: string };
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_MESSAGE_CHARS = 700;
const MAX_HISTORY_TOTAL_CHARS = 2_400;

export function sanitizeEndoBotHistory(value: unknown): EndoBotHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  const sanitized: EndoBotHistoryMessage[] = [];
  let totalChars = 0;
  for (const item of value.slice(-MAX_HISTORY_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { role?: unknown; content?: unknown };
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") continue;
    const content = normalizeSecurityText(candidate.content);
    if (!content || content.length > MAX_HISTORY_MESSAGE_CHARS || detectEndoBotSecuritySignals(content).length) continue;
    const redactedContent = sanitizeHistoryContent(content);
    if (totalChars + redactedContent.length > MAX_HISTORY_TOTAL_CHARS) continue;
    sanitized.push({ role: candidate.role, content: redactedContent });
    totalChars += redactedContent.length;
  }
  return sanitized;
}

function sanitizeHistoryContent(content: string) {
  let redactedContent = content;
  const privatePatterns = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /\b\+?\d{1,3}[\s.-]?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g,
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  ];
  for (const pattern of privatePatterns) redactedContent = redactedContent.replace(pattern, "[dado removido]");
  return redactedContent;
}

export function detectEndoBotHistorySecuritySignals(value: unknown): EndoBotSecuritySignal[] {
  if (!Array.isArray(value)) return [];
  return uniqueSignals(value.slice(-MAX_HISTORY_MESSAGES).flatMap((item) => {
    if (!item || typeof item !== "object" || typeof (item as { content?: unknown }).content !== "string") return [];
    return detectEndoBotSecuritySignals((item as { content: string }).content.slice(0, MAX_HISTORY_MESSAGE_CHARS));
  }));
}

export function detectEndoBotSecuritySignals(value: string): EndoBotSecuritySignal[] {
  const normalized = normalizeSecurityText(value);
  const signals = securityPatterns.filter(({ pattern }) => pattern.test(normalized)).map(({ signal }) => signal);
  if (credentialRequestPattern.test(normalized)) signals.push("credential_request");
  if (secretMaterialPattern.test(normalized) || inlineSecretPattern.test(normalized)) signals.push("secret_material");
  if (/[\u202A-\u202E\u2066-\u2069]/.test(value)) signals.push("obfuscation");
  return uniqueSignals(signals);
}

export function detectEndoBotOutputSignals(value: string): EndoBotSecuritySignal[] {
  const normalized = normalizeSecurityText(value);
  const signals: EndoBotSecuritySignal[] = [];
  if (secretMaterialPattern.test(normalized) || inlineSecretPattern.test(normalized)) signals.push("secret_material");
  if (outputLeakagePattern.test(normalized)) signals.push("output_leakage");
  return uniqueSignals(signals);
}

export function classifyEndoBotSignals(signals: EndoBotSecuritySignal[]) {
  const category = signals.some((signal) => ["secret_material", "output_leakage"].includes(signal)) ? "sensitive_disclosure" : signals.some((signal) => ["destructive_command", "data_exfiltration"].includes(signal)) ? "destructive_request" : signals.includes("fault_injection") ? "fault_injection" : signals.includes("credential_request") ? "credential_access" : "prompt_injection" as EndoBotThreatCategory;
  const severity = signals.some((signal) => ["secret_material", "output_leakage", "destructive_command", "data_exfiltration", "credential_request"].includes(signal)) ? "critical" : signals.some((signal) => ["fault_injection", "tool_execution"].includes(signal)) ? "high" : "medium" as EndoBotThreatSeverity;
  const riskScore = severity === "critical" ? 5 : severity === "high" ? 4 : 3;
  return { category, severity, riskScore };
}

export function hasEndoBotSecurityThreat(value: string) {
  return detectEndoBotSecuritySignals(value).length > 0;
}

export function fingerprintEndoBotIp(ipAddress: string, secret: string) {
  return createHmac("sha256", secret).update(ipAddress).digest("hex");
}

export function fingerprintEndoBotQuestion(question: string) {
  return createHash("sha256").update(question).digest("hex");
}

export function shouldSuspendAfterRepeat(previousEventsForSubject: number) {
  return previousEventsForSubject >= 1;
}
