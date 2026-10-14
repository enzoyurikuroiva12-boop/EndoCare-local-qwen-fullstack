import { describe, expect, it } from "vitest";
import { evaluateAuthLimit } from "./authRateLimit";

describe("limite local de tentativas de autenticação", () => {
  it("permite tentativas até o limite da janela", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("email-signup", [now - 20_000, now - 10_000], now);
    expect(result.allowed).toBe(true);
    expect(result.timestamps).toHaveLength(3);
  });

  it("bloqueia novos envios quando a janela de cadastro já atingiu o limite", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("email-signup", [now - 30_000, now - 20_000, now - 10_000, now - 5_000], now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("libera novas tentativas de login trinta segundos após o limite", () => {
    const now = 1_000_000;
    const blocked = evaluateAuthLimit("email-login", [now - 20_000, now - 15_000, now - 10_000, now - 5_000, now - 1_000], now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);

    const released = evaluateAuthLimit("email-login", [now - 30_001, now - 20_000, now - 15_000, now - 10_000, now - 5_000], now);
    expect(released.allowed).toBe(true);
  });

  it("descarta tentativas que já saíram da janela", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("resend-link", [now - 601_000, now - 600_001, now - 10_000], now);
    expect(result.allowed).toBe(true);
    expect(result.timestamps).toHaveLength(2);
  });

  it("limita mudanças de senha com uma janela própria", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("password-update", [now - 12_000, now - 9_000, now - 2_000], now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("limita o envio administrativo de recuperação de senha", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("admin-password-reset", [now - 20_000, now - 10_000, now - 2_000], now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("limita a senha adicional do painel após cinco tentativas em quinze minutos", () => {
    const now = 1_000_000;
    const result = evaluateAuthLimit("admin-access-gate", [now - 50_000, now - 40_000, now - 30_000, now - 20_000, now - 10_000], now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
