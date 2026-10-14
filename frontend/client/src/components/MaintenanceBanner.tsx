import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import "./MaintenanceBanner.css";

export const maintenanceBannerCopy = {
  pt: {
    title: "Site em Manutenção",
    message: "Algumas funções foram desabilitadas",
  },
  en: {
    title: "Site under maintenance",
    message: "Some features have been temporarily disabled",
  },
  es: {
    title: "Sitio en mantenimiento",
    message: "Algunas funciones fueron deshabilitadas temporalmente",
  },
} as const;

// A faixa só deve aparecer após a leitura do estado público; nunca deve piscar durante o carregamento.
export const maintenanceMode = false;

export function MaintenanceBanner() {
  const { language } = useSiteLanguage();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadMaintenanceStatus = async () => {
      const { data, error } = await supabase.rpc("get_endoacolhe_maintenance_status");
      if (mounted) setEnabled(!error && typeof data === "boolean" ? data : maintenanceMode);
    };
    void loadMaintenanceStatus();
    const handleMaintenanceUpdate = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled;
      if (typeof next === "boolean") setEnabled(next);
    };
    window.addEventListener("endoacolhe:maintenance-updated", handleMaintenanceUpdate);
    return () => {
      mounted = false;
      window.removeEventListener("endoacolhe:maintenance-updated", handleMaintenanceUpdate);
    };
  }, []);

  if (enabled !== true) return null;
  const t = maintenanceBannerCopy[language];

  return (
    <aside className="maintenance-banner is-active" role="status" aria-live="polite">
      <Hammer size={18} strokeWidth={2.2} aria-hidden="true" />
      <span>
        <strong>{t.title}</strong>{" "}
        <small>{t.message}</small>
      </span>
    </aside>
  );
}
