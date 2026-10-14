import { ArrowLeft, Globe2, Menu, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { DesktopMenuActions } from "@/components/DesktopMenuActions";
import { EndoAcolheMark } from "@/components/EndoAcolheMark";
import { MobileMenuActions } from "@/components/MobileMenuActions";
import { MotionSystem } from "@/components/MotionSystem";
import Questionnaire from "@/components/Questionnaire";
import { SiteCopyright } from "@/components/SiteCopyright";
import { useAuth } from "@/_core/hooks/useAuth";
import { siteLanguages, useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { loginButtonCopy } from "@/lib/loginButtonCopy";
import { navigateWithTransition } from "@/lib/pageNavigation";
import "@/styles/AcolhedoraTheme.css";
import "./QuestionnairePage.css";

export const questionnairePageCopy = {
  pt: {
    safety: "Conteúdo apenas informativo.",
    safetyRest: "Não recomendamos o uso de plantas, suplementos, medicamentos ou tratamentos sem prescrição médica e acompanhamento de um profissional.",
    home: "Início",
    phytotherapy: "Fitoterapia",
    diary: "Diário",
    bot: "EndoBot",
    learn: "Saiba mais",
    questionnaire: "Questionário",
    blog: "Blog",
    stories: "Relatos",
    account: "Configuração da conta",
    login: loginButtonCopy.pt,
    language: "Idioma do site",
    nav: "Navegação principal",
    menu: "Abrir menu",
    footer: "Site totalmente informativo.",
    footerRest: "Não recomendamos uso de plantas, suplementos, medicamentos ou tratamentos; qualquer uso deve ocorrer apenas sob prescrição ou recomendação de profissional.",
    credit: "Desenvolvido por alunos do",
    back: "Voltar ao topo ↑",
  },
  en: {
    safety: "Informational content only.",
    safetyRest: "We do not recommend the use of plants, supplements, medicines, or treatments without a medical prescription and professional follow-up.",
    home: "Home",
    phytotherapy: "Phytotherapy",
    diary: "Diary",
    bot: "EndoBot",
    learn: "Learn more",
    questionnaire: "Questionnaire",
    blog: "Blog",
    stories: "Stories",
    account: "Account settings",
    login: loginButtonCopy.en,
    language: "Site language",
    nav: "Main navigation",
    menu: "Open menu",
    footer: "A fully informational site.",
    footerRest: "We do not recommend plants, supplements, medicines, or treatments; any use should only occur with a prescription or professional recommendation.",
    credit: "Developed by students from",
    back: "Back to top ↑",
  },
  es: {
    safety: "Contenido únicamente informativo.",
    safetyRest: "No recomendamos el uso de plantas, suplementos, medicamentos o tratamientos sin prescripción médica y seguimiento profesional.",
    home: "Inicio",
    phytotherapy: "Fitoterapia",
    diary: "Diario",
    bot: "EndoBot",
    learn: "Saber más",
    questionnaire: "Cuestionario",
    blog: "Blog",
    stories: "Relatos",
    account: "Configuración de la cuenta",
    login: loginButtonCopy.es,
    language: "Idioma del sitio",
    nav: "Navegación principal",
    menu: "Abrir menu",
    footer: "Sitio totalmente informativo.",
    footerRest: "No recomendamos plantas, suplementos, medicamentos o tratamientos; cualquier uso debe realizarse únicamente con prescripción o recomendación de profesional.",
    credit: "Desarrollado por alumnos de",
    back: "Volver arriba ↑",
  },
} as const;

export default function QuestionnairePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { language, setLanguage } = useSiteLanguage();
  const t = questionnairePageCopy[language];
  const go = (path: string) => { setMenuOpen(false); navigateWithTransition(path); };

  return <div className="site-root questionnaire-page">
    <MotionSystem />
    <aside className="safety-banner" role="note" aria-label={t.safety}><ShieldAlert size={14} /><span><strong>{t.safety}</strong> {t.safetyRest}</span></aside>
    <header className="topbar">
      <button className="brand" onClick={() => go("/")} aria-label={t.home}><span className="brand-mark"><EndoAcolheMark size={28} /></span><span>EndoCare</span></button>
      <nav className={menuOpen ? "topnav open" : "topnav"} aria-label={t.nav}>
        <button onClick={() => go("/")}><ArrowLeft size={15} /> {t.home}</button>
        <button onClick={() => go("/#fitoterapia")}>{t.phytotherapy}</button>
        <button onClick={() => go("/diario")}>{t.diary}</button>
        <button onClick={() => go("/#endobot")}>{t.bot}</button>
        <button onClick={() => go("/#saiba-mais")}>{t.learn}</button>
        <button className="is-current" aria-current="page">{t.questionnaire}</button>
        <button onClick={() => go("/blog")}>{t.blog}</button>
        <button onClick={() => go("/#relatos")}>{t.stories}</button>
        <MobileMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={t.login} actionsLabel={t.nav} onAccountClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("endoacolhe:open-account-settings")); }} />
      </nav>
      <div className="topbar-utility-controls">
        <label className="site-language-select"><Globe2 size={15} /><span className="sr-only">{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} aria-label={t.language}>{siteLanguages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <DesktopMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={t.login} onAccountClick={() => window.dispatchEvent(new Event("endoacolhe:open-account-settings"))} />
      </div>
      <button className="menu-button" aria-label={t.menu} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
    </header>
    <main id="questionario-page-main"><Questionnaire /></main>
    <footer className="site-footer"><div className="brand"><span className="brand-mark"><EndoAcolheMark size={26} /></span><span>EndoCare</span></div><p><strong>{t.footer}</strong> {t.footerRest}</p><p className="school-credit">{t.credit} <strong>SESI</strong>.</p><SiteCopyright /><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{t.back}</button></footer>
    <AccountSettingsDialog />
  </div>;
}
