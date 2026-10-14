import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import { navigateWithTransition } from "@/lib/pageNavigation";
import { hasAdministrativeRole } from "@/lib/adminAccess";

const labels = { pt: "Administração", en: "Administration", es: "Administración" } as const;

export function AdminShortcut() {
  const { user, isAuthenticated } = useAuth();
  const { language } = useSiteLanguage();
  const [isAdministrator, setIsAdministrator] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !user) { setIsAdministrator(false); return; }
    void supabase.rpc("current_endoacolhe_admin_role").then(({ data, error }) => {
      if (active) setIsAdministrator(!error && hasAdministrativeRole(data));
    });
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  if (!isAdministrator) return null;
  return <button className="nav-cta admin-shortcut" type="button" aria-label={labels[language]} title={labels[language]} onClick={() => navigateWithTransition("/admin")}><ShieldCheck size={15} /><span className="admin-shortcut__label">{labels[language]}</span></button>;
}
