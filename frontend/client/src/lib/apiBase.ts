const DEFAULT_API_BASE = "https://backendendoacolhe.vercel.app";
const ngrokHostname = /(?:^|\.)ngrok(?:-free)?\.(?:app|dev|io)$/i;

export function resolveApiBaseUrl(configuredBase: string | undefined, hostname: string) {
  if (ngrokHostname.test(hostname)) return "";
  return configuredBase ?? DEFAULT_API_BASE;
}

export function resolveBrowserApiBaseUrl(configuredBase: string | undefined) {
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  return resolveApiBaseUrl(configuredBase, hostname);
}
