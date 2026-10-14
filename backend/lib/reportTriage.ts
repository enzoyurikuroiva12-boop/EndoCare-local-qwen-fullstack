export const reportTriageLabels = ["adequate", "needs_review", "likely_spam"] as const;
export type ReportTriageLabel = typeof reportTriageLabels[number];

export type DeterministicTriage = {
  label: ReportTriageLabel;
  signals: string[];
  confidence: number;
};

const urlPattern = /(?:https?:\/\/|www\.)\S+/giu;
const repeatedChunkPattern = /(.{1,8})\1{4,}/isu;
const repeatedCharacterPattern = /(.)\1{9,}/su;

function normalizedText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function runDeterministicReportChecks(alias: string, content: string): DeterministicTriage {
  const text = normalizedText(`${alias} ${content}`);
  const compactContent = normalizedText(content).replace(/\s+/gu, "");
  const lettersAndNumbers = compactContent.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const urls = content.match(urlPattern)?.length ?? 0;
  const signals: string[] = [];

  if (lettersAndNumbers < 12 || repeatedCharacterPattern.test(compactContent) || repeatedChunkPattern.test(compactContent)) {
    signals.push("low_information_or_repetition");
  }
  if (urls >= 2) signals.push("multiple_links");
  if (/(?:ganhe dinheiro|clique aqui|oferta imperdível|casino|apostas|venda agora)/iu.test(text)) {
    signals.push("promotional_or_gambling_pattern");
  }

  if (signals.includes("low_information_or_repetition")) {
    return { label: "likely_spam", signals, confidence: 0.98 };
  }
  if (signals.length) return { label: "needs_review", signals, confidence: 0.86 };
  return { label: "adequate", signals: [], confidence: 0.58 };
}

export function mergeReportTriage(deterministic: DeterministicTriage, model: { label: ReportTriageLabel; confidence: number; reasons: string[] } | null) {
  if (deterministic.label === "likely_spam") return deterministic;
  if (!model) return { label: "needs_review" as const, confidence: 0.5, signals: ["ai_check_unavailable"] };
  if (deterministic.label === "needs_review" && model.label === "adequate") {
    return { label: "needs_review" as const, confidence: Math.min(deterministic.confidence, model.confidence), signals: [...deterministic.signals, ...model.reasons] };
  }
  return { label: model.label, confidence: Math.max(0, Math.min(1, model.confidence)), signals: [...deterministic.signals, ...model.reasons].slice(0, 5) };
}

export function isReportTriageLabel(value: unknown): value is ReportTriageLabel {
  return typeof value === "string" && (reportTriageLabels as readonly string[]).includes(value);
}

export function parseModelTriage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { label?: unknown; confidence?: unknown; reasons?: unknown };
  if (!isReportTriageLabel(candidate.label) || typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence)) return null;
  const reasons = Array.isArray(candidate.reasons) ? candidate.reasons.filter((reason): reason is string => typeof reason === "string" && Boolean(reason.trim())).slice(0, 3) : [];
  return { label: candidate.label, confidence: Math.max(0, Math.min(1, candidate.confidence)), reasons };
}

export function parseModelJson(text: string) {
  try {
    return parseModelTriage(JSON.parse(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/u);
    if (!match) return null;
    try { return parseModelTriage(JSON.parse(match[0])); } catch { return null; }
  }
}
