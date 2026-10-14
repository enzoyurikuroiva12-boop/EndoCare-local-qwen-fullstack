import { describe, expect, it } from "vitest";
import { buildPainChartData, calculateDiarySummary } from "./SymptomDiary";

describe("gráfico de dor do diário", () => {
  it("ordena os pontos do mais antigo ao mais recente e preserva a sequência de registros da mesma data", () => {
    const chart = buildPainChartData([
      { id: "newer", date: "2026-08-21", createdAt: 300, pain: 5, mood: "Neutro", bleeding: "Não", medication: "", notes: "" },
      { id: "older-date", date: "2026-08-20", createdAt: 900, pain: 2, mood: "Bem", bleeding: "Não", medication: "", notes: "" },
      { id: "older-same-date", date: "2026-08-21", createdAt: 100, pain: 10, mood: "Sensível", bleeding: "Intenso", medication: "", notes: "" },
    ]);

    expect(chart.map((record) => record.id)).toEqual(["older-date", "older-same-date", "newer"]);
    expect(chart.map((record) => record.chartPoint)).toEqual([1, 2, 3]);
    expect(chart.map((record) => record.createdAt)).toEqual([900, 100, 300]);
  });
});

describe("resumo do diário", () => {
  it("calcula registros, dias distintos, média de dor e identifica o registro mais recente", () => {
    const summary = calculateDiarySummary([
      { id: "older", date: "2026-08-20", createdAt: 100, pain: 2, mood: "Bem", bleeding: "Não", medication: "none", notes: "" },
      { id: "newer", date: "2026-08-21", createdAt: 300, pain: 6, mood: "Neutro", bleeding: "Leve", medication: "none", notes: "" },
      { id: "same-day", date: "2026-08-21", createdAt: 200, pain: 4, mood: "Sensível", bleeding: "Não", medication: "none", notes: "" },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.trackedDays).toBe(2);
    expect(summary.averagePain).toBe(4);
    expect(summary.latest?.id).toBe("newer");
  });
});
