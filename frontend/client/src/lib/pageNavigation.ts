export const PAGE_EXIT_DURATION_MS = 240;

export function shouldAnimatePageTransition(prefersReducedMotion: boolean) {
  return !prefersReducedMotion;
}

export function navigateWithTransition(href: string) {
  const root = document.querySelector<HTMLElement>(".site-root");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!root || !shouldAnimatePageTransition(prefersReducedMotion)) {
    window.location.assign(href);
    return;
  }

  root.classList.add("route-exiting");
  root.setAttribute("aria-busy", "true");
  window.setTimeout(() => window.location.assign(href), PAGE_EXIT_DURATION_MS);
}
