import { useEffect, useState } from "react";
import { ArrowLeft, History, LockKeyhole, LogIn, RefreshCw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { SiteCopyright } from "@/components/SiteCopyright";
import { supabase } from "@/lib/supabase";
import { staffCan, type AccountStatus, type StaffRole } from "@/lib/accountManagement";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import "./Admin.css";
import "./AdminAccountControls.css";

type PunishmentLog = { id: string; actor_name: string | null; actor_email: string | null; target_name: string | null; target_email: string | null; previous_status: AccountStatus; next_status: AccountStatus; reason: string | null; created_at: string; expires_at: string | null };

export function canOpenPunishmentLog(role: StaffRole | null, additionalAccessGranted: boolean) {
  return additionalAccessGranted && staffCan(role, "viewPunishmentLogs");
}

export default function AdminPunishmentLog() {
  const { user, loading: authLoading } = useAuth();
  const { language, locale } = useSiteLanguage();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [additionalAccessGranted, setAdditionalAccessGranted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PunishmentLog[]>([]);
  const [failed, setFailed] = useState(false);
  const t = language === "en" ? { title: "Punishment log", intro: "Traceable record of administrative changes to account status.", back: "Back to administration", locked: "Protected access", lockedText: "Use the Administration page and enter the additional password to view the punishment log.", denied: "Access restricted", deniedText: "Your role cannot view punishment records.", signIn: "Sign in to continue", empty: "No punishment records yet.", by: "By", until: "Measure until", refresh: "Refresh", loading: "Loading records…", failure: "Unable to load punishment records right now." } : language === "es" ? { title: "Registro de sanciones", intro: "Registro verificable de los cambios administrativos de estado de cuenta.", back: "Volver a administración", locked: "Acceso protegido", lockedText: "Usa la página Administración e ingresa la contraseña adicional para ver el registro de sanciones.", denied: "Acceso restringido", deniedText: "Tu cargo no puede ver los registros de sanciones.", signIn: "Entrar para continuar", empty: "Aún no hay registros de sanciones.", by: "Por", until: "Medida hasta", refresh: "Actualizar", loading: "Cargando registros…", failure: "No fue posible cargar los registros de sanciones ahora." } : { title: "Log de punições", intro: "Registro rastreável das mudanças administrativas de status de conta.", back: "Voltar à Administração", locked: "Acesso protegido", lockedText: "Use a página Administração e informe a senha adicional para visualizar o Log de punições.", denied: "Acesso restrito", deniedText: "Seu cargo não pode visualizar os registros de punições.", signIn: "Entrar para continuar", empty: "Ainda não há registros de punições.", by: "Por", until: "Medida até", refresh: "Atualizar", loading: "Carregando registros…", failure: "Não foi possível carregar os registros de punições agora." };

  async function loadEntries() {
    if (!canOpenPunishmentLog(role, additionalAccessGranted)) return;
    setLoading(true); setFailed(false);
    const { data, error } = await supabase.rpc("list_endoacolhe_punishment_log");
    if (error) setFailed(true); else setEntries((data ?? []) as PunishmentLog[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!user) { setRole(null); setAdditionalAccessGranted(false); setChecking(false); return; }
    let active = true;
    void Promise.all([supabase.rpc("current_endoacolhe_admin_role"), supabase.rpc("has_endoacolhe_admin_access")]).then(([{ data: roleData }, { data: gateOpen }]) => {
      if (!active) return;
      setRole((roleData ?? null) as StaffRole | null);
      setAdditionalAccessGranted(Boolean(gateOpen));
      setChecking(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => { void loadEntries(); }, [role, additionalAccessGranted]);

  useEffect(() => {
    if (!canOpenPunishmentLog(role, additionalAccessGranted)) return;
    const channel = supabase.channel("punishment-log-live").on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_realtime_signal" }, () => void loadEntries()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [role, additionalAccessGranted]);

  if (authLoading || checking) return <main className="admin-guard"><RefreshCw className="admin-spinner" size={24} /><p>{t.loading}</p></main>;
  if (!user) return <main className="admin-guard"><LogIn size={30} /><h1>{t.title}</h1><p>{t.lockedText}</p><button className="primary-button" type="button" onClick={() => startLogin()}>{t.signIn}</button></main>;
  if (!staffCan(role, "viewPunishmentLogs")) return <main className="admin-guard"><LockKeyhole size={30} /><h1>{t.denied}</h1><p>{t.deniedText}</p><a className="admin-return" href="/admin"><ArrowLeft size={16} />{t.back}</a></main>;
  if (!additionalAccessGranted) return <main className="admin-guard"><LockKeyhole size={30} /><h1>{t.locked}</h1><p>{t.lockedText}</p><a className="primary-button" href="/admin">{t.back}</a></main>;

  return <main className="admin-page admin-punishment-log-page"><header className="admin-routebar"><a className="admin-return" href="/admin"><ArrowLeft size={16} />{t.back}</a><span className="admin-routebar__context"><span><History size={15} />{t.title}</span></span></header><header className="admin-header"><div><h1>{t.title}</h1><p>{t.intro}</p></div><button className="admin-refresh" type="button" onClick={() => void loadEntries()} disabled={loading}>{loading ? <RefreshCw className="admin-spinner" size={15} /> : <RefreshCw size={15} />}{t.refresh}</button></header>{failed ? <p className="admin-notice">{t.failure}</p> : null}<section className="admin-panel admin-punishment-panel admin-punishment-panel--standalone"><div className="admin-panel__heading"><span><History size={18} />{t.title}</span><small>{entries.length}</small></div>{entries.length ? <div className="admin-punishment-list">{entries.map((item) => <article key={item.id}><div><strong>{item.target_name || item.target_email || "—"}</strong><span>{item.previous_status} → {item.next_status}</span></div><p><b>{t.by}:</b> {item.actor_name || item.actor_email || "—"} · {new Date(item.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p><p>{item.reason || "—"}{item.expires_at ? ` · ${t.until}: ${new Date(item.expires_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : ""}</p></article>)}</div> : <div className="admin-empty"><History size={25} /><p>{t.empty}</p></div>}</section><SiteCopyright className="admin-site-copyright" /></main>;
}
