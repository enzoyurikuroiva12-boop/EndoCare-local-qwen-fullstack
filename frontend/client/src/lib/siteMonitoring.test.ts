import { describe, expect, it } from "vitest";
import { isAdministrativeMonitoringPath, isPublicMonitoringPath, normalizeMonitoredPath, reservePageViewForSession } from "./siteMonitoring";

describe("monitoramento mínimo do site", () => {
  it("permite apenas rotas públicas conhecidas e ignora rotas não monitoradas", () => {
    expect(normalizeMonitoredPath("/diario")).toBe("/diario");
    expect(normalizeMonitoredPath("/blog?origem=menu")).toBe("/blog");
    expect(normalizeMonitoredPath("/404")).toBeNull();
    expect(normalizeMonitoredPath("/area-privada?email=pessoa@example.com")).toBeNull();
    expect(isPublicMonitoringPath("/")).toBe(true);
    expect(isPublicMonitoringPath("/404")).toBe(false);
  });

  it("identifica o painel administrativo para excluí-lo da telemetria de navegação", () => {
    expect(isAdministrativeMonitoringPath("/admin")).toBe(true);
    expect(isAdministrativeMonitoringPath("/blog")).toBe(false);
  });

  it("não reserva visualização para /404 nem para rotas privadas", () => {
    expect(reservePageViewForSession("/404")).toBe(false);
    expect(reservePageViewForSession("/area-privada")).toBe(false);
  });
});
