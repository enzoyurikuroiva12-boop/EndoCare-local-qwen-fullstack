import { describe, expect, it } from "vitest";
import { blockedAnswer, forbiddenPattern, sanitizeQuestion } from "./safety.js";

describe("proteção do EndoBot", () => {
  it("remove e-mail do texto antes do processamento", () => { expect(sanitizeQuestion("Meu e-mail é ana@example.com").content).not.toContain("ana@example.com"); });
  it("bloqueia pedidos relacionados a arquivo", () => { expect(forbiddenPattern.test("leia meu arquivo")).toBe(true); expect(blockedAnswer()).not.toMatch(/arquivo|pdf/i); });
});
