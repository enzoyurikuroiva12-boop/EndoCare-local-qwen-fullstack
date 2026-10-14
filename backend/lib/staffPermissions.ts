export type StaffRole = "owner" | "admin" | "moderator" | "support" | null;

export function canResetPasswordDirectly(role: StaffRole) {
  return role === "owner";
}

export function canDeleteAccounts(role: StaffRole) {
  return role === "owner" || role === "admin";
}
