import { describe, expect, it } from "vitest";
import { isStrongPassword } from "./passwordPolicy.js";

describe("server password policy", () => {
  it("rejeita requisitos ausentes e repetição excessiva", () => {
    expect(isStrongPassword("acolher123!")).toBe(false);
    expect(isStrongPassword("Acolhersemnumero!")).toBe(false);
    expect(isStrongPassword("Acolher1234")).toBe(false);
    expect(isStrongPassword("Aaaa!1234567")).toBe(false);
  });

  it("aceita senha que atende todos os requisitos", () => {
    expect(isStrongPassword("Ciclo!2026A")).toBe(true);
  });
});
