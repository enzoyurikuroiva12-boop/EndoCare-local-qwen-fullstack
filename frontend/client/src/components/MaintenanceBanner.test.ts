import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

import { maintenanceBannerCopy } from "./MaintenanceBanner";

describe("maintenanceBannerCopy", () => {
  it("exibe a mensagem de manutenção solicitada em português", () => {
    expect(maintenanceBannerCopy.pt.title).toBe("Site em Manutenção");
    expect(maintenanceBannerCopy.pt.message).toBe("Algumas funções foram desabilitadas");
  });

  it("mantém versões localizadas para os demais idiomas", () => {
    expect(maintenanceBannerCopy.en.title).toBeTruthy();
    expect(maintenanceBannerCopy.en.message).toBeTruthy();
    expect(maintenanceBannerCopy.es.title).toBeTruthy();
    expect(maintenanceBannerCopy.es.message).toBeTruthy();
  });

  it("aplica o deslocamento somente na faixa ativa", () => {
    const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/MaintenanceBanner.tsx"), "utf8");
    const styleSource = readFileSync(resolve(process.cwd(), "client/src/components/MaintenanceBanner.css"), "utf8");
    const themeSource = readFileSync(resolve(process.cwd(), "client/src/styles/AcolhedoraTheme.css"), "utf8");
    expect(componentSource).toContain('className="maintenance-banner is-active"');
    expect(styleSource).toContain(".maintenance-banner.is-active");
    expect(styleSource).toContain("margin-top: 8px;");
    expect(themeSource).toContain(":root { --maintenance-banner-offset: 0px; }");
    expect(themeSource).toContain(":root:has(.maintenance-banner.is-active)");
    expect(themeSource).toContain("--maintenance-banner-offset: calc(var(--maintenance-banner-height, 48px) + 8px);");
  });

  it("mantém a faixa oculta até receber o estado público de manutenção", () => {
    const componentSource = readFileSync(resolve(process.cwd(), "client/src/components/MaintenanceBanner.tsx"), "utf8");
    expect(componentSource).toContain("useState<boolean | null>(null)");
    expect(componentSource).toContain("if (enabled !== true) return null;");
    expect(componentSource).toContain('setEnabled(!error && typeof data === "boolean" ? data : maintenanceMode)');
  });
});
