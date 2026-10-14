import { Sparkles } from "lucide-react";
import { AdminShortcut } from "@/components/AdminShortcut";
import { startLogin } from "@/const";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import type { EndoUser } from "@/_core/hooks/useAuth";

export function DesktopMenuActions({ isAuthenticated, accountLabel, loginLabel, onAccountClick, user }: { isAuthenticated: boolean; accountLabel: string; loginLabel: string; onAccountClick: () => void; user?: Pick<EndoUser, "name" | "avatarPath"> | null }) {
  return isAuthenticated ? <><AdminShortcut /><button className="nav-cta account-cta desktop-account-cta" type="button" aria-label={accountLabel} title={accountLabel} onClick={onAccountClick}><ProfileAvatar name={user?.name || accountLabel} avatarPath={user?.avatarPath} size="small" /></button></> : <button className="nav-cta desktop-login-cta" type="button" aria-label={loginLabel} title={loginLabel} onClick={() => startLogin()}><Sparkles size={15} /><span>{loginLabel}</span></button>;
}
