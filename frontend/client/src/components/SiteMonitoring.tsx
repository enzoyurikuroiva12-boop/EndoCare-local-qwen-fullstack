import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { isAdministrativeMonitoringPath, isPublicMonitoringPath, reservePageViewForSession, trackSiteEvent } from "@/lib/siteMonitoring";

export function SiteMonitoring() {
  const [location] = useLocation();
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (isAdministrativeMonitoringPath(location) || !isPublicMonitoringPath(location)) return;
    const eventKey = `page_view:${location}`;
    if (!sent.current.has(eventKey) && reservePageViewForSession(location)) {
      sent.current.add(eventKey);
      void trackSiteEvent("page_view", location);
    }

    const timer = window.setTimeout(() => void trackSiteEvent("engaged_15s", location), 15_000);
    let halfSent = false;
    let depthSent = false;
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (!halfSent && ratio >= 0.5) { halfSent = true; void trackSiteEvent("scroll_50", location); }
      if (!depthSent && ratio >= 0.9) { depthSent = true; void trackSiteEvent("scroll_90", location); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, [location]);

  useEffect(() => {
    if (!isPublicMonitoringPath(window.location.pathname)) return;
    const onError = () => void trackSiteEvent("runtime_error", window.location.pathname);
    const onUnhandledRejection = () => void trackSiteEvent("runtime_error", window.location.pathname);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onUnhandledRejection); };
  }, []);

  return null;
}
