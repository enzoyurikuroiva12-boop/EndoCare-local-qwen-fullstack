import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { activeAccountControl, type AccountControl } from "@/lib/accountControl";

type AccountNotification = { id: string; kind: string; message: string; created_at: string };
type AccountControlContextValue = { control: AccountControl; notifications: AccountNotification[]; loading: boolean; refresh: () => Promise<void>; dismissNotification: (id: string) => Promise<void> };
const AccountControlContext = createContext<AccountControlContextValue | null>(null);

export function AccountControlProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [control, setControl] = useState<AccountControl>(activeAccountControl);
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setControl(activeAccountControl); setNotifications([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: controlData }, { data: notificationData }] = await Promise.all([
      supabase.rpc("current_endoacolhe_account_control"),
      supabase.from("account_notifications").select("id,kind,message,created_at").is("read_at", null).order("created_at", { ascending: false }).limit(8),
    ]);
    const next = controlData && typeof controlData === "object" ? controlData as Partial<AccountControl> : activeAccountControl;
    setControl({ status: next.status === "restricted" || next.status === "suspended" ? next.status : "active", reason: typeof next.reason === "string" ? next.reason : null, expires_at: typeof next.expires_at === "string" ? next.expires_at : null });
    setNotifications((notificationData ?? []) as AccountNotification[]);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`account-control-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_controls", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "account_notifications", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (!control.expires_at) return;
    const remaining = new Date(control.expires_at).getTime() - Date.now();
    if (remaining <= 0) { void refresh(); return; }
    const timeout = window.setTimeout(() => void refresh(), remaining + 250);
    return () => window.clearTimeout(timeout);
  }, [control.expires_at]);

  const dismissNotification = async (id: string) => {
    const { error } = await supabase.from("account_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (!error) setNotifications((items) => items.filter((item) => item.id !== id));
  };

  return <AccountControlContext.Provider value={useMemo(() => ({ control, notifications, loading, refresh, dismissNotification }), [control, notifications, loading])}>{children}</AccountControlContext.Provider>;
}

export function useAccountControl() {
  const value = useContext(AccountControlContext);
  if (!value) throw new Error("useAccountControl must be used within AccountControlProvider");
  return value;
}
