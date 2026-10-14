import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { navigateWithTransition } from "@/lib/pageNavigation";
import "./SiteCopyright.css";

const copy = {
  pt: "Todos os direitos reservados.",
  en: "All rights reserved.",
  es: "Todos los derechos reservados.",
} as const;

export function SiteCopyright({ className = "site-copyright" }: { className?: string }) {
  const { language } = useSiteLanguage();
  return <div className={className}><p className="site-copyright__notice">© 2026 EndoCare. {copy[language]}</p><nav className="site-copyright__links" aria-label="Documentos públicos"><button type="button" onClick={() => navigateWithTransition("/faq")}>FAQ</button><button type="button" onClick={() => navigateWithTransition("/termos")}>{language === "en" ? "Terms" : language === "es" ? "Términos" : "Termos"}</button><button type="button" onClick={() => navigateWithTransition("/privacidade")}>{language === "en" ? "Privacy" : language === "es" ? "Privacidad" : "Privacidade"}</button></nav></div>;
}
