import { supabase } from "@/lib/supabase";
import { getProfileAvatarPath, getProfileName } from "@/lib/authProfile";
import { useCallback, useEffect, useMemo, useState } from "react";

export type EndoUser = { id: string; email: string | null; name: string; role: "user" | "admin"; avatarPath: string | null };

function toEndoUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): EndoUser {
  return { id: user.id, email: user.email ?? null, name: getProfileName(user), role: user.app_metadata?.role === "admin" ? "admin" : "user", avatarPath: getProfileAvatarPath(user) };
}

export function useAuth() {
  const [user, setUser] = useState<EndoUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => { if (mounted) { setUser(data.user ? toEndoUser(data.user) : null); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? toEndoUser(session.user) : null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        try { window.sessionStorage.setItem("endoacolhe:password-recovery", "1"); } catch { /* A recuperação permanece disponível pelas configurações da conta. */ }
        window.dispatchEvent(new Event("endoacolhe:open-account-settings"));
      }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  const logout = useCallback(async () => { await supabase.auth.signOut(); setUser(null); }, []);
  return useMemo(() => ({ user, loading, error: null, isAuthenticated: Boolean(user), refresh: async () => { const { data } = await supabase.auth.getUser(); setUser(data.user ? toEndoUser(data.user) : null); }, logout }), [loading, logout, user]);
}
