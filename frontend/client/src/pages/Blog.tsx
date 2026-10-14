import { useEffect, useState } from "react";
import { ArrowLeft, BookOpenText, Clock3, Globe2, Menu, Pin, RefreshCw, ShieldAlert, X } from "lucide-react";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { DesktopMenuActions } from "@/components/DesktopMenuActions";
import { EndoAcolheMark } from "@/components/EndoAcolheMark";
import { MobileMenuActions } from "@/components/MobileMenuActions";
import { SiteCopyright } from "@/components/SiteCopyright";
import { MotionSystem } from "@/components/MotionSystem";
import { siteLanguages, useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import { navigateWithTransition } from "@/lib/pageNavigation";
import { loginButtonCopy } from "@/lib/loginButtonCopy";
import { useAuth } from "@/_core/hooks/useAuth";
import "@/styles/AcolhedoraTheme.css";
import "./Blog.css";
import { SeoMeta, seoCopy } from "@/components/SeoMeta";

type PublishedPost = {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  published_at: string | null;
  is_pinned: boolean;
};

export function formatRelativePublishedTime(value: string, locale: string, now = new Date()) {
  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return "";
  const seconds = Math.round((publishedAt.getTime() - now.getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1]];
  const [unit, divisor] = units.find(([, amount]) => Math.abs(seconds) >= amount) ?? units.at(-1)!;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.round(seconds / divisor), unit);
}

export const blogPageCopy = {
  pt: {
    safety: "Conteúdo apenas informativo.", safetyRest: "Não recomendamos o uso de plantas, suplementos, medicamentos ou tratamentos sem prescrição médica e acompanhamento de um profissional.", back: "Início", stories: "Relatos", questionnaire: "Questionário", account: "Configuração da conta", login: "Entrar com e-mail", language: "Idioma do site", nav: "Navegação principal", menu: "Abrir menu", title: "Leituras para ampliar a conversa.", intro: "Artigos informativos para organizar perguntas, interpretar fontes com cuidado e dialogar com profissionais sem transformar informação em prescrição.", note: "O EndoCare não recomenda tratamentos, produtos, doses ou plantas.", latest: "Artigos publicados", loading: "Carregando artigos…", emptyTitle: "Novas leituras chegarão em breve.", emptyText: "Quando a administração publicar um artigo, ele aparecerá aqui para leitura pública.", loadError: "Não foi possível carregar os artigos agora.", published: "Publicado", pinned: "Em destaque", footer: "Site totalmente informativo.", footerRest: "Não recomendamos uso de plantas, suplementos, medicamentos ou tratamentos; qualquer uso deve ocorrer apenas sob prescrição ou recomendação de profissional.", credit: "Desenvolvido por alunos do",
  },
  en: {
    safety: "Informational content only.", safetyRest: "We do not recommend the use of plants, supplements, medicines, or treatments without a medical prescription and professional follow-up.", back: "Home", stories: "Stories", questionnaire: "Questionnaire", account: "Account settings", login: "Sign in with email", language: "Site language", nav: "Main navigation", menu: "Open menu", title: "Readings that expand the conversation.", intro: "Informational articles to organize questions, interpret sources with care, and speak with professionals without turning information into a prescription.", note: "EndoCare does not recommend treatments, products, dosages, or plants.", latest: "Published articles", loading: "Loading articles…", emptyTitle: "New readings will be here soon.", emptyText: "When the administration publishes an article, it will appear here for public reading.", loadError: "Articles cannot be loaded right now.", published: "Published", pinned: "Featured", footer: "A fully informational site.", footerRest: "We do not recommend plants, supplements, medicines, or treatments; any use should only occur with a prescription or professional recommendation.", credit: "Developed by students from",
  },
  es: {
    safety: "Contenido únicamente informativo.", safetyRest: "No recomendamos el uso de plantas, suplementos, medicamentos o tratamientos sin prescripción médica y seguimiento profesional.", back: "Inicio", stories: "Relatos", questionnaire: "Cuestionario", account: "Configuración de la cuenta", login: "Entrar con correo", language: "Idioma del sitio", nav: "Navegación principal", menu: "Abrir menú", title: "Lecturas para ampliar la conversación.", intro: "Artículos informativos para organizar dudas, interpretar fuentes con cuidado y dialogar con profesionales sin convertir la información en prescripción.", note: "EndoCare no recomienda tratamientos, productos, dosis ni plantas.", latest: "Artículos publicados", loading: "Cargando artículos…", emptyTitle: "Pronto habrá nuevas lecturas.", emptyText: "Cuando la administración publique un artículo, aparecerá aquí para lectura pública.", loadError: "No es posible cargar los artículos en este momento.", published: "Publicado", pinned: "Destacado", footer: "Sitio totalmente informativo.", footerRest: "No recomendamos plantas, suplementos, medicamentos o tratamientos; cualquier uso debe realizarse únicamente con prescripción o recomendación profesional.", credit: "Desarrollado por alumnos de",
  },
} as const;

export default function Blog() {
  const { language, locale, setLanguage } = useSiteLanguage();
  const { isAuthenticated, user } = useAuth();
  const t = blogPageCopy[language];
  const seo = seoCopy[language];
  const loginButtonLabel = loginButtonCopy[language];
  const [menuOpen, setMenuOpen] = useState(false);
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const go = (path: string) => { setMenuOpen(false); navigateWithTransition(path); };

  useEffect(() => {
    let mounted = true;
    async function loadPosts() {
      setLoading(true); setHasError(false);
      const { data, error } = await supabase.from("blog_posts").select("id,category,title,summary,content,published_at,is_pinned").eq("status", "published").order("is_pinned", { ascending: false }).order("pinned_at", { ascending: false }).order("published_at", { ascending: false });
      if (!mounted) return;
      if (error) setHasError(true); else setPosts((data ?? []) as PublishedPost[]);
      setLoading(false);
    }
    void loadPosts();
    return () => { mounted = false; };
  }, []);

  return <div className="blog-page-root">
    <SeoMeta title={seo.blogTitle} description={seo.blogDescription} path="/blog" />
    <MotionSystem />
    <aside className="safety-banner" role="note" aria-label={t.safety}><ShieldAlert size={14} /><span><strong>{t.safety}</strong> {t.safetyRest}</span></aside>
    <header className="topbar blog-topbar">
      <button className="brand" onClick={() => go("/")} aria-label={t.back}><span className="brand-mark"><EndoAcolheMark size={28} /></span><span>EndoCare</span></button>
      <nav className={menuOpen ? "topnav blog-topnav open" : "topnav blog-topnav"} aria-label={t.nav}><button onClick={() => go("/")}><ArrowLeft size={15} /> {t.back}</button><button onClick={() => go("/#relatos")}>{t.stories}</button><button onClick={() => go("/questionario")}>{t.questionnaire}</button><MobileMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={loginButtonLabel} actionsLabel={t.nav} onAccountClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("endoacolhe:open-account-settings")); }} /></nav>
      <div className="topbar-utility-controls"><label className="site-language-select"><Globe2 size={15} /><span className="sr-only">{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} aria-label={t.language}>{siteLanguages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><DesktopMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={loginButtonLabel} onAccountClick={() => window.dispatchEvent(new Event("endoacolhe:open-account-settings"))} /></div>
      <button className="menu-button" aria-label={t.menu} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
    </header>
    <main className="blog-page-main">
      <section className="blog-page-intro" aria-labelledby="blog-title"><div><h1 id="blog-title">{t.title}</h1><p>{t.intro}</p></div><p className="blog-page-note"><BookOpenText size={18} /><span>{t.note}</span></p></section>
      <section className="blog-posts-section" aria-labelledby="published-articles"><h2 id="published-articles">{t.latest}</h2>{loading ? <div className="blog-status"><RefreshCw className="blog-spinner" size={20} /><span>{t.loading}</span></div> : hasError ? <div className="blog-status blog-status-error" role="alert"><span>{t.loadError}</span></div> : posts.length ? <div className="blog-reading-list">{posts.map((post) => <article className={post.is_pinned ? "blog-reading-item is-pinned" : "blog-reading-item"} key={post.id}><header><span className="blog-reading-category"><span>{post.category}</span>{post.is_pinned ? <em><Pin size={13} aria-hidden="true" />{t.pinned}</em> : null}</span>{post.published_at ? <time className="blog-published-meta" dateTime={post.published_at}><Clock3 size={14} aria-hidden="true" /><span><strong>{t.published} {new Date(post.published_at).toLocaleString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong><small>{formatRelativePublishedTime(post.published_at, locale)}</small></span></time> : null}</header><h3>{post.title}</h3><p className="blog-reading-summary">{post.summary}</p><div className="blog-reading-content">{post.content.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${post.id}-${index}`}>{paragraph}</p>)}</div></article>)}</div> : <div className="blog-status"><BookOpenText size={27} /><strong>{t.emptyTitle}</strong><span>{t.emptyText}</span></div>}</section>
    </main>
    <footer className="site-footer"><div className="brand"><span className="brand-mark"><EndoAcolheMark size={26} /></span><span>EndoCare</span></div><p><strong>{t.footer}</strong> {t.footerRest}</p><p className="school-credit">{t.credit} <strong>SESI</strong>.</p><SiteCopyright /><button onClick={() => { window.location.href = "/"; }}>{t.back} ↑</button></footer>
    <AccountSettingsDialog />
  </div>;
}
