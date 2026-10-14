import { describe, expect, it } from "vitest";
import { isAllowedEndoBotOrigin, isAllowedSiteMonitoringOrigin } from "./cors.js";

describe("origens permitidas do EndoBot", () => {
  it("permite os domínios públicos principal e de backup", () => {
    expect(isAllowedEndoBotOrigin("https://endo-acolhe.vercel.app")).toBe(true);
    expect(isAllowedEndoBotOrigin("https://endoacolhe-backup.vercel.app")).toBe(true);
  });

  it("rejeita origens não autorizadas", () => {
    expect(isAllowedEndoBotOrigin("https://origem-nao-confiavel.example")).toBe(false);
  });

  it("permite uma origem adicional configurada no ambiente", () => {
    expect(isAllowedEndoBotOrigin("https://staging.example", "https://staging.example")).toBe(true);
  });

  it("permite monitoramento somente pelo site principal, além de uma origem configurada", () => {
    expect(isAllowedSiteMonitoringOrigin("https://endo-acolhe.vercel.app")).toBe(true);
    expect(isAllowedSiteMonitoringOrigin("https://endoacolhe-backup.vercel.app")).toBe(false);
    expect(isAllowedSiteMonitoringOrigin("https://staging.example", "https://staging.example")).toBe(true);
  });
});
