import { AlertTriangle, Bell, Headphones, LogOut, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { useAccountControl } from "@/contexts/AccountControlContext";
import { blocksSiteAccess } from "@/lib/accountControl";
import { AccountSupportChat } from "@/components/AccountSupportChat";
import "./AccountAccessGate.css";

const copy = {
  pt: { restricted: "Sua conta está Restrita. Por favor, contate um administrador para saber o motivo.", suspendedTitle: "Conta suspensa", suspended: "Sua conta está suspensa. Para saber o motivo ou solicitar uma revisão, fale com a administração abaixo.", loading: "Verificando o acesso da conta…", signOut: "Sair da conta", notifications: "Avisos da sua conta", contact: "Falar com a administração", endsAt: "Esta medida termina em", noEnd: "Esta medida permanece ativa até nova revisão." },
  en: { restricted: "Your account is restricted. Please contact an administrator to learn why.", suspendedTitle: "Account suspended", suspended: "Your account is suspended. To learn why or request a review, contact administration below.", loading: "Checking account access…", signOut: "Sign out", notifications: "Account notices", contact: "Contact administration", endsAt: "This measure ends on", noEnd: "This measure remains active until a new review." },
  es: { restricted: "Tu cuenta está restringida. Contacta a una persona administradora para saber el motivo.", suspendedTitle: "Cuenta suspendida", suspended: "Tu cuenta está suspendida. Para conocer el motivo o solicitar una revisión, habla con la administración abajo.", loading: "Verificando el acceso de la cuenta…", signOut: "Cerrar sesión", notifications: "Avisos de tu cuenta", contact: "Hablar con administración", endsAt: "Esta medida termina el", noEnd: "Esta medida permanece activa hasta una nueva revisión." },
} as const;

export function AccountAccessGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const { language } = useSiteLanguage();
  const { control, loading, notifications, dismissNotification } = useAccountControl();
  const [supportOpen, setSupportOpen] = useState(false);
  const t = copy[language];
  if (isAuthenticated && loading) return <main className="account-gate-loading" aria-live="polite">{t.loading}</main>;
  const expiry = control.expires_at ? new Date(control.expires_at).toLocaleString(language === "en" ? "en-US" : language === "es" ? "es-ES" : "pt-BR", { dateStyle: "medium", timeStyle: "short" }) : null;
  if (isAuthenticated && blocksSiteAccess(control)) return <main className="account-suspended-screen" role="alert"><ShieldAlert size={34} /><h1>{t.suspendedTitle}</h1><p>{t.suspended}</p><p className="account-control-expiry">{expiry ? <><strong>{t.endsAt}</strong> {expiry}</> : t.noEnd}</p>{supportOpen ? <AccountSupportChat className="account-support-chat--suspended" /> : <button type="button" onClick={() => setSupportOpen(true)}><Headphones size={16} />{t.contact}</button>}<button type="button" onClick={() => void logout()}><LogOut size={16} />{t.signOut}</button></main>;
  return <>{isAuthenticated && control.status === "restricted" ? <aside className="account-restriction-banner" role="alert"><AlertTriangle size={18} /><span>{t.restricted}<small>{expiry ? `${t.endsAt} ${expiry}` : t.noEnd}</small></span><button type="button" onClick={() => setSupportOpen((current) => !current)}><Headphones size={15} />{t.contact}</button></aside> : null}{isAuthenticated && control.status === "restricted" && supportOpen ? <AccountSupportChat className="account-support-chat--popover" /> : null}{isAuthenticated && notifications.length ? <aside className="account-notifications" aria-label={t.notifications}><strong><Bell size={15} />{t.notifications}</strong>{notifications.map((notice) => <p key={notice.id}><span>{notice.message}</span><button type="button" onClick={() => void dismissNotification(notice.id)} aria-label="Fechar"><X size={15} /></button></p>)}</aside> : null}{children}</>;
}
