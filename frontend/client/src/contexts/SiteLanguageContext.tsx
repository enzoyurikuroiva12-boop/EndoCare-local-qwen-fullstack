import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BotLanguage } from "@/lib/endoBotLanguage";

export type SiteLanguage = BotLanguage;

export const siteLanguages: Array<{ value: SiteLanguage; label: string }> = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

type SiteLanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  locale: string;
};

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null);
const STORAGE_KEY = "endoacolhe-site-language";

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SiteLanguage>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "es" || saved === "pt" ? saved : "pt";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === "pt" ? "pt-BR" : language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, locale: language === "pt" ? "pt-BR" : language === "es" ? "es-ES" : "en-US" }), [language]);
  return <SiteLanguageContext.Provider value={value}>{children}</SiteLanguageContext.Provider>;
}

export function useSiteLanguage() {
  const value = useContext(SiteLanguageContext);
  if (!value) throw new Error("useSiteLanguage deve ser usado dentro de SiteLanguageProvider");
  return value;
}
