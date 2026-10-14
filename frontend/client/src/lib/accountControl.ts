export type AccountControlStatus = "active" | "restricted" | "suspended";

export type AccountControl = {
  status: AccountControlStatus;
  reason: string | null;
  expires_at: string | null;
};

export const activeAccountControl: AccountControl = { status: "active", reason: null, expires_at: null };

export function blocksSiteAccess(control: AccountControl) {
  return control.status === "suspended";
}

export function blocksRestrictedFeatures(control: AccountControl) {
  return control.status === "restricted" || control.status === "suspended";
}
