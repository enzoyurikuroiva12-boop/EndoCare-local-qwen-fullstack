import { Sparkles } from "lucide-react";
import { AdminShortcut } from "@/components/AdminShortcut";
import { startLogin } from "@/const";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import type { EndoUser } from "@/_core/hooks/useAuth";

export function MobileMenuActions({ isAuthenticated, accountLabel, loginLabel, actionsLabel, onAccountClick, user }: { isAuthenticated: boolean; accountLabel: string; loginLabel: string; actionsLabel: string; onAccountClick: () => void; user?: Pick<EndoUser, "name" | "avatarPath"> | null }) {
  return <div className="mobile-menu-actions" aria-label={actionsLabel}>
    {isAuthenticated ? <><AdminShortcut /><button className="nav-cta mobile-account-cta" type="button" aria-label={accountLabel} title={accountLabel} onClick={onAccountClick}><ProfileAvatar name={user?.name || accountLabel} avatarPath={user?.avatarPath} size="small" /></button></> : <button className="nav-cta mobile-login-cta" type="button" aria-label={loginLabel} title={loginLabel} onClick={() => startLogin()}><Sparkles size={15} /> {loginLabel}</button>}
  </div>;
}
