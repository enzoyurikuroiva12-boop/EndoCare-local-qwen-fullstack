import { supabase } from "@/lib/supabase";

const monitoredPaths = ["/", "/diario", "/blog"] as const;
const monitoredEventTypes = ["page_view", "engaged_15s", "scroll_50", "scroll_90", "runtime_error"] as const;

export type MonitoredPath = (typeof monitoredPaths)[number];
export type MonitoredEventType = (typeof monitoredEventTypes)[number];

const backendUrl = import.meta.env.VITE_API_BASE_URL || "https://backendendoacolhe.vercel.app";
const sessionStorageKey = "endoacolhe-site-monitoring-session";
const viewedRoutesStorageKey = "endoacolhe-site-monitoring-viewed-routes";

export function isAdministrativeMonitoringPath(pathname: string) {
  return pathname === "/admin";
}

export function normalizeMonitoredPath(pathname: string): MonitoredPath | null {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return (monitoredPaths as readonly string[]).includes(path) ? path as MonitoredPath : null;
}

export function isPublicMonitoringPath(pathname: string) {
  return normalizeMonitoredPath(pathname) !== null;
}

export function monitoringViewport(width = window.innerWidth) {
  return width < 760 ? "mobile" as const : "desktop" as const;
}

function monitoringSessionId() {
  try {
    const existing = window.sessionStorage.getItem(sessionStorageKey);
    if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) return existing;
    const created = window.crypto.randomUUID().replace(/-/g, "");
    window.sessionStorage.setItem(sessionStorageKey, created);
    return created;
  } catch {
    return window.crypto.randomUUID().replace(/-/g, "");
  }
}

export function reservePageViewForSession(pathname: string) {
  if (isAdministrativeMonitoringPath(pathname)) return false;
  const path = normalizeMonitoredPath(pathname);
  if (!path) return false;
  try {
    const raw = window.sessionStorage.getItem(viewedRoutesStorageKey);
    const viewed = raw ? JSON.parse(raw) : [];
    const routes = Array.isArray(viewed) ? viewed.filter((value): value is MonitoredPath => typeof value === "string" && (monitoredPaths as readonly string[]).includes(value)) : [];
    if (routes.includes(path)) return false;
    window.sessionStorage.setItem(viewedRoutesStorageKey, JSON.stringify([...routes, path]));
    return true;
  } catch {
    return true;
  }
}

export function currentMonitoringLocale() {
  const locale = document.documentElement.lang.slice(0, 2);
  return locale === "en" || locale === "es" ? locale : "pt";
}

export async function trackSiteEvent(eventType: MonitoredEventType, pathname = window.location.pathname) {
  if (isAdministrativeMonitoringPath(pathname)) return;
  const path = normalizeMonitoredPath(pathname);
  if (!path) return;
  const body = JSON.stringify({ eventType, path, sessionId: monitoringSessionId(), locale: currentMonitoringLocale(), viewport: monitoringViewport() });
  try {
    await fetch(`${backendUrl}/api/site-monitoring`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    // A telemetria é opcional e nunca interfere no uso do site.
  }
}

export async function loadSiteMonitoring(days: 7 | 30 = 7) {
  const { data, error } = await supabase.rpc("list_endoacolhe_site_monitoring", { p_days: days });
  if (error) throw error;
  return data as SiteMonitoringSnapshot;
}

export async function resetSiteMonitoring() {
  const { data, error } = await supabase.rpc("reset_endoacolhe_site_monitoring");
  if (error) throw error;
  return data as { deleted_events: number };
}

export type SiteMonitoringSnapshot = {
  days: number;
  overview: { views: number; sessions: number; engaged_sessions: number; errors: number; admin_actions: number };
  series: Array<{ date: string; views: number; sessions: number; engaged_sessions: number; errors: number }>;
  routes: Array<{ path: MonitoredPath; views: number; sessions: number }>;
  admin_actions: { account_controls: number; content_deletions: number; password_actions: number; role_changes: number };
};
