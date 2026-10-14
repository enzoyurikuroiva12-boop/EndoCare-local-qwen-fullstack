import { useEffect } from "react";

const SITE_NAME = "EndoCare";
const SITE_ORIGIN = "https://endo-acolhe.vercel.app";

export interface SeoMetaProps {
  title: string;
  description: string;
  path: string;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function SeoMeta({ title, description, path }: SeoMetaProps) {
  useEffect(() => {
    const canonicalUrl = `${SITE_ORIGIN}${path === "/" ? "/" : path}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
  }, [description, path, title]);

  return null;
}

export const seoCopy = {
  pt: {
    homeTitle: "Endometriose: sintomas, informação e acolhimento | EndoCare",
    homeDescription: "Informação educativa sobre endometriose, sintomas e dor pélvica, com acolhimento, diário e preparo para conversas de cuidado.",
    blogTitle: "Blog sobre endometriose e cuidado | EndoCare",
    blogDescription: "Artigos educativos sobre endometriose, sintomas, exames, diagnóstico e vida cotidiana, com linguagem responsável.",
    faqTitle: "FAQ sobre o EndoCare e endometriose | EndoCare",
    faqDescription: "Respostas sobre o EndoCare, seus recursos, privacidade e limites das informações educativas sobre endometriose.",
    termsTitle: "Termos de Uso | EndoCare",
    termsDescription: "Leia os Termos de Uso do EndoCare, plataforma educativa e de acolhimento sobre endometriose.",
    privacyTitle: "Política de Privacidade | EndoCare",
    privacyDescription: "Conheça como o EndoCare trata dados, privacidade e segurança em seus recursos educativos sobre endometriose.",
  },
  en: {
    homeTitle: "Endometriosis: symptoms, information and support | EndoCare",
    homeDescription: "Educational information about endometriosis, symptoms and pelvic pain, with supportive tools for care conversations.",
    blogTitle: "Endometriosis and care blog | EndoCare",
    blogDescription: "Educational articles about endometriosis, symptoms, exams, diagnosis and everyday life, written responsibly.",
    faqTitle: "EndoCare and endometriosis FAQ | EndoCare",
    faqDescription: "Answers about EndoCare, its features, privacy and the limits of educational endometriosis information.",
    termsTitle: "Terms of Use | EndoCare",
    termsDescription: "Read the EndoCare Terms of Use for this educational and supportive endometriosis platform.",
    privacyTitle: "Privacy Policy | EndoCare",
    privacyDescription: "Learn how EndoCare handles data, privacy and security across its educational endometriosis resources.",
  },
  es: {
    homeTitle: "Endometriosis: síntomas, información y apoyo | EndoCare",
    homeDescription: "Información educativa sobre endometriosis, síntomas y dolor pélvico, con apoyo para conversaciones de cuidado.",
    blogTitle: "Blog sobre endometriosis y cuidado | EndoCare",
    blogDescription: "Artículos educativos sobre endometriosis, síntomas, exámenes, diagnóstico y vida cotidiana, con lenguaje responsable.",
    faqTitle: "Preguntas frecuentes sobre EndoCare y endometriosis | EndoCare",
    faqDescription: "Respuestas sobre EndoCare, sus recursos, privacidad y los límites de la información educativa sobre endometriosis.",
    termsTitle: "Términos de Uso | EndoCare",
    termsDescription: "Lee los Términos de Uso de EndoCare, plataforma educativa y de apoyo sobre endometriosis.",
    privacyTitle: "Política de Privacidad | EndoCare",
    privacyDescription: "Conoce cómo EndoCare trata los datos, la privacidad y la seguridad en sus recursos educativos.",
  },
} as const;

export type SeoLanguage = keyof typeof seoCopy;
