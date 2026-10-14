import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VLibrasBaseUrl, VLibrasScriptUrl, shouldOfferVLibrasRetry } from "./LibrasAccessibility";

describe("integração de acessibilidade em Libras", () => {
  it("usa o script oficial e o endereço-base do VLibras", () => {
    expect(VLibrasBaseUrl).toBe("https://vlibras.gov.br/app");
    expect(VLibrasScriptUrl).toBe("https://vlibras.gov.br/app/vlibras-plugin.js");
  });

  it("oferece nova tentativa apenas se o script oficial falhar", () => {
    expect(shouldOfferVLibrasRetry("failed")).toBe(true);
    expect(shouldOfferVLibrasRetry("loading")).toBe(false);
    expect(shouldOfferVLibrasRetry("ready")).toBe(false);
  });

  it("mantém a marcação oficial no JSX desde a montagem inicial", () => {
    const source = readFileSync(new URL("./LibrasAccessibility.tsx", import.meta.url), "utf8");
    expect(source).toContain('<div vw="true"');
    expect(source).toContain('<div vw-access-button="true"');
    expect(source).toContain('<div vw-plugin-wrapper="true"');
    expect(source).toContain("document.head.appendChild(script)");
    expect(source).not.toContain("window.dispatchEvent(new Event(\"load\"))");
  });

  it("permite apenas os hosts oficiais necessários para carregar o módulo complementar", () => {
    const configuration = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"));
    const policy = configuration.headers[0].headers.find((header: { key: string }) => header.key === "Content-Security-Policy").value as string;

    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' https://vercel.live https://vlibras.gov.br https://www.vlibras.gov.br");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://vlibras.gov.br https://www.vlibras.gov.br https://cdn.jsdelivr.net https://traducao2.vlibras.gov.br https://traducao2-dth.vlibras.gov.br https://dicionario2.vlibras.gov.br https://dicionario2-dth.vlibras.gov.br https://repositorio.vlibras.gov.br https://repositorio-dth.vlibras.gov.br https://us.i.posthog.com");
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain("child-src 'self' blob:");
  });
});
