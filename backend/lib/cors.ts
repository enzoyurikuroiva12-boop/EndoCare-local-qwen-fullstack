const trustedEndoBotOrigins = [
  "https://endo-acolhe.vercel.app",
  "https://endoacolhe-backup.vercel.app",
] as const;

const trustedSiteMonitoringOrigins = ["https://endo-acolhe.vercel.app"] as const;

export function isAllowedEndoBotOrigin(origin: string | undefined, frontendOrigin = process.env.FRONTEND_ORIGIN) {
  if (!origin) return false;

  return new Set([...trustedEndoBotOrigins, frontendOrigin].filter((value): value is string => Boolean(value))).has(origin);
}

export function isAllowedSiteMonitoringOrigin(origin: string | undefined, frontendOrigin = process.env.FRONTEND_ORIGIN) {
  if (!origin) return false;
  return new Set([...trustedSiteMonitoringOrigins, frontendOrigin].filter((value): value is string => Boolean(value))).has(origin);
}
