export type ModerationAction = "approve" | "reject";
export const administrativeRoles = ["owner", "admin", "moderator", "support"] as const;
export type AdministrativeRole = (typeof administrativeRoles)[number];

export function normalizeAdministrativeRole(role: unknown): AdministrativeRole | null {
  const normalized = typeof role === "string" ? role.trim().toLowerCase() : "";
  return administrativeRoles.includes(normalized as AdministrativeRole) ? normalized as AdministrativeRole : null;
}

export function hasAdministrativeRole(role: unknown): role is AdministrativeRole {
  return normalizeAdministrativeRole(role) !== null;
}

export function moderationStatus(action: ModerationAction) {
  return action === "approve" ? "approved" : "rejected";
}

export function moderationLabel(action: ModerationAction, language: "pt" | "en" | "es" = "pt") {
  const labels = {
    pt: { approve: "Aprovar", reject: "Rejeitar" },
    en: { approve: "Approve", reject: "Reject" },
    es: { approve: "Aprobar", reject: "Rechazar" },
  };
  return labels[language][action];
}
