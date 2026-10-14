export const accountStatuses = ["active", "restricted", "suspended"] as const;
export type AccountStatus = (typeof accountStatuses)[number];
export const staffRoles = ["owner", "admin", "moderator", "support"] as const;
export type StaffRole = (typeof staffRoles)[number];
export type AssignableStaffRole = Exclude<StaffRole, "owner">;

export type ManagedAccount = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  status: AccountStatus;
  reason: string | null;
  updated_at: string | null;
  is_administrator: boolean;
  expires_at: string | null;
  is_owner: boolean;
  admin_role: AssignableStaffRole | null;
  punishment_count: number;
};

export function staffCan(role: StaffRole | null, permission: "viewUsers" | "applyPunishments" | "moderateStories" | "manageContent" | "manageBlog" | "supportChat" | "viewPunishmentLogs" | "deleteAccounts" | "sendPasswordReset" | "resetPasswordDirectly" | "manageRoles" | "manageQuestionnaire" | "viewQuestionnaireResults") {
  if (role === "owner") return true;
  if (role === "admin") return permission !== "resetPasswordDirectly" && permission !== "manageRoles";
  if (role === "moderator") return ["viewUsers", "applyPunishments", "moderateStories", "supportChat", "viewPunishmentLogs"].includes(permission);
  if (role === "support") return ["supportChat", "viewPunishmentLogs"].includes(permission);
  return false;
}

export function punishmentReputation(punishmentCount: number) {
  if (punishmentCount === 0) return "good" as const;
  if (punishmentCount <= 2) return "attention" as const;
  return "very-poor" as const;
}

export function canManageAccount(account: ManagedAccount, currentUserId: string | undefined) {
  return !account.is_administrator && !account.is_owner && account.user_id !== currentUserId;
}

export function canManageAdministratorRole(account: ManagedAccount, currentUserId: string | undefined, currentUserIsOwner: boolean) {
  return currentUserIsOwner && !account.is_owner && account.user_id !== currentUserId;
}

export function canResetPunishmentReputation(account: ManagedAccount, currentUserId: string | undefined, currentUserIsOwner: boolean) {
  return currentUserIsOwner && !account.is_owner && !account.is_administrator && account.user_id !== currentUserId && account.punishment_count > 0;
}

export function accountActionsFor(status: AccountStatus): AccountStatus[] {
  if (status === "active") return ["restricted", "suspended"];
  return ["active"];
}

export function needsAccountReason(status: AccountStatus) {
  return status !== "active";
}
