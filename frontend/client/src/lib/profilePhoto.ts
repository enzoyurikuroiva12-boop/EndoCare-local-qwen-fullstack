export const PROFILE_PHOTO_BUCKET = "endoacolhe-profile-photos";
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export const profilePhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProfilePhotoMimeType = (typeof profilePhotoMimeTypes)[number];

export function isProfilePhotoMimeType(value: string): value is ProfilePhotoMimeType {
  return profilePhotoMimeTypes.includes(value as ProfilePhotoMimeType);
}

export function getProfilePhotoExtension(type: ProfilePhotoMimeType) {
  return type === "image/jpeg" ? "jpg" : type.slice("image/".length);
}

