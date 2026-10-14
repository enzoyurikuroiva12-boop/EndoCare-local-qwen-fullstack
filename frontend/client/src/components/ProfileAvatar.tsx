import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PROFILE_PHOTO_BUCKET } from "@/lib/profilePhoto";
import "./ProfileAvatar.css";

type ProfileAvatarProps = {
  name: string;
  avatarPath?: string | null;
  size?: "small" | "medium" | "large";
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "EC";
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`).toUpperCase();
}

export function ProfileAvatar({ name, avatarPath, size = "medium" }: ProfileAvatarProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const initials = useMemo(() => getInitials(name), [name]);

  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    if (!avatarPath) return () => { active = false; };
    void supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(avatarPath, 60 * 60).then(({ data, error }) => {
      if (active && !error) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [avatarPath]);

  return <span className={`profile-avatar profile-avatar--${size}`} aria-label={`Foto de perfil de ${name}`} role="img">{signedUrl ? <img src={signedUrl} alt="" onError={() => setSignedUrl(null)} /> : <span aria-hidden="true">{initials}</span>}</span>;
}

export { getInitials };
