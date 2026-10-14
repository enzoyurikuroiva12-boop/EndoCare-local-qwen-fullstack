type ProfileMetadata = Record<string, unknown> | undefined;

export type AuthProfile = {
  email?: string;
  user_metadata?: ProfileMetadata;
};

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

export function getProfileName(profile: AuthProfile) {
  const metadata = profile.user_metadata;
  return cleanName(metadata?.name) || cleanName(metadata?.full_name) || cleanName(metadata?.given_name) || profile.email?.split("@")[0] || "Minha conta";
}

export function getProfileAvatarPath(profile: { id?: string; user_metadata?: ProfileMetadata }) {
  const userId = typeof profile.id === "string" ? profile.id : "";
  const value = profile.user_metadata?.avatar_path;
  if (!userId || typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.startsWith(`${userId}/`) && normalized.length <= 220 ? normalized : null;
}
