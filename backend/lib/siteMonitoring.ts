export const siteMonitoringEventTypes = ["page_view", "engaged_15s", "scroll_50", "scroll_90", "runtime_error"] as const;
export const siteMonitoringRoutes = ["/", "/diario", "/blog"] as const;
export const siteMonitoringLocales = ["pt", "en", "es"] as const;
export const siteMonitoringViewports = ["mobile", "desktop"] as const;

export type SiteMonitoringEventType = (typeof siteMonitoringEventTypes)[number];
export type SiteMonitoringRoute = (typeof siteMonitoringRoutes)[number];
export type SiteMonitoringLocale = (typeof siteMonitoringLocales)[number];
export type SiteMonitoringViewport = (typeof siteMonitoringViewports)[number];

export type SiteMonitoringPayload = {
  eventType: SiteMonitoringEventType;
  path: SiteMonitoringRoute;
  sessionId: string;
  locale: SiteMonitoringLocale;
  viewport: SiteMonitoringViewport;
};

function isIn<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function parseSiteMonitoringPayload(value: unknown): SiteMonitoringPayload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!isIn(input.eventType, siteMonitoringEventTypes) || !isIn(input.path, siteMonitoringRoutes) || !isIn(input.locale, siteMonitoringLocales) || !isIn(input.viewport, siteMonitoringViewports)) return null;
  if (typeof input.sessionId !== "string" || !/^[a-zA-Z0-9_-]{16,64}$/.test(input.sessionId)) return null;
  return { eventType: input.eventType, path: input.path, sessionId: input.sessionId, locale: input.locale, viewport: input.viewport };
}
