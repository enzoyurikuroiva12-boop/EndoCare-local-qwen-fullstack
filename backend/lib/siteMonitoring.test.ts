import { describe, expect, it } from "vitest";
import { parseSiteMonitoringPayload } from "./siteMonitoring.js";

describe("telemetria mínima do site", () => {
  const valid = { eventType: "page_view", path: "/blog", sessionId: "T6x8gP2kL4mN9qRs", locale: "pt", viewport: "desktop" };

  it("aceita somente eventos conhecidos e uma sessão efêmera com formato seguro", () => {
    expect(parseSiteMonitoringPayload(valid)).toEqual(valid);
    expect(parseSiteMonitoringPayload({ ...valid, path: "/private-account" })).toBeNull();
    expect(parseSiteMonitoringPayload({ ...valid, path: "/404" })).toBeNull();
    expect(parseSiteMonitoringPayload({ ...valid, eventType: "chat_content" })).toBeNull();
  });

  it("recusa eventos e rotas administrativas para que o painel não infle as métricas públicas", () => {
    expect(parseSiteMonitoringPayload({ ...valid, path: "/admin" })).toBeNull();
    expect(parseSiteMonitoringPayload({ ...valid, eventType: "admin_open" })).toBeNull();
  });

  it("não aceita identificadores com dados arbitrários", () => {
    expect(parseSiteMonitoringPayload({ ...valid, sessionId: "contato@exemplo.com" })).toBeNull();
    expect(parseSiteMonitoringPayload({ ...valid, locale: "fr" })).toBeNull();
  });
});
