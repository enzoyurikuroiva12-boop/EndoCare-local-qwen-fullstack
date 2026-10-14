import { describe, expect, it } from "vitest";
import { evaluatePassword, isPasswordValid } from "./passwordPolicy";

describe("password policy", () => {
  it("exige comprimento, maiúscula, número, caractere especial e ausência de repetição excessiva", () => {
    expect(isPasswordValid("acolher123!")).toBe(false);
    expect(isPasswordValid("Acolhersemnumero!")).toBe(false);
    expect(isPasswordValid("Acolher1234")).toBe(false);
    expect(isPasswordValid("Aaaa!1234567")).toBe(false);
    expect(isPasswordValid("Ciclo!2026A")).toBe(true);
  });

  it("classifica senhas válidas curtas como boas e as mais longas como seguras", () => {
    expect(evaluatePassword("Ciclo!2026A").strength).toBe("good");
    expect(evaluatePassword("Ciclo!2026Acolhe").strength).toBe("secure");
  });
});
