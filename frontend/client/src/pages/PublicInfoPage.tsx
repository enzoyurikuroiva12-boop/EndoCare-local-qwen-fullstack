import { ChevronLeft, CircleHelp, FileText, ShieldCheck } from "lucide-react";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { EndoAcolheMark } from "@/components/EndoAcolheMark";
import { SiteCopyright } from "@/components/SiteCopyright";
import { navigateWithTransition } from "@/lib/pageNavigation";
import { publicLegalCopy, type LegalPageKind } from "@/lib/legalContent";
import "./PublicInfoPage.css";
import { SeoMeta, seoCopy } from "@/components/SeoMeta";

const icons = { faq: CircleHelp, terms: FileText, privacy: ShieldCheck } as const;

export function PublicInfoPage({ kind }: { kind: LegalPageKind }) {
  const { language } = useSiteLanguage();
  const copy = publicLegalCopy[language];
  const Icon = icons[kind];
  const title = kind === "faq" ? copy.faqTitle : kind === "terms" ? copy.termsTitle : copy.privacyTitle;
  const intro = kind === "faq" ? copy.faqIntro : kind === "terms" ? copy.termsIntro : copy.privacyIntro;
  const sections = kind === "terms" ? copy.terms : kind === "privacy" ? copy.privacy : [];
  const seo = seoCopy[language];
  const seoTitle = kind === "faq" ? seo.faqTitle : kind === "terms" ? seo.termsTitle : seo.privacyTitle;
  const seoDescription = kind === "faq" ? seo.faqDescription : kind === "terms" ? seo.termsDescription : seo.privacyDescription;
  const seoPath = kind === "faq" ? "/faq" : kind === "terms" ? "/termos" : "/privacidade";

  return <div className="public-info-page"><SeoMeta title={seoTitle} description={seoDescription} path={seoPath} />
    <header className="public-info-header">
      <button className="public-info-brand" onClick={() => navigateWithTransition("/")} aria-label={copy.back}><span className="public-info-mark"><EndoAcolheMark size={26} /></span><span>EndoCare</span></button>
      <button className="public-info-back" onClick={() => navigateWithTransition("/")}><ChevronLeft size={17} />{copy.back}</button>
    </header>
    <main className="public-info-main">
      <section className="public-info-hero">
        <span className="public-info-icon"><Icon size={25} /></span>
        <div><span className="public-info-eyebrow">ENDOACOLHE · {copy.important}</span><h1>{title}</h1><p>{intro}</p>{kind !== "faq" ? <span className="public-info-version">{copy.updated}</span> : null}</div>
      </section>
      {kind === "faq" ? <section className="faq-list" aria-label={title}>{copy.faq.map((item, index) => <details key={item.question} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}</summary><p>{item.answer}</p></details>)}</section> : <article className="legal-document">{sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}</article>}
    </main>
    <footer className="public-info-footer"><p>{copy.support}</p><SiteCopyright /></footer>
  </div>;
}
