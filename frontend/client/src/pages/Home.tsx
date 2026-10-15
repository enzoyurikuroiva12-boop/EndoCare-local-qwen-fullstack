import { useState } from "react";
import { ArrowDown, ArrowRight, BookOpen, Captions, CirclePlay, ExternalLink, Flower2, Globe2, HeartHandshake, Menu, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { DesktopMenuActions } from "@/components/DesktopMenuActions";
import { EndoAcolheMark } from "@/components/EndoAcolheMark";
import { MobileMenuActions } from "@/components/MobileMenuActions";
import { SiteCopyright } from "@/components/SiteCopyright";
import { BotanicalViewer, PlantKey } from "@/components/BotanicalViewer";
import { EndoBotPanel } from "@/components/EndoBotPanel";
import { BlogAndCommunity } from "@/components/BlogAndCommunity";
import { MotionSystem } from "@/components/MotionSystem";
import "@/styles/AcolhedoraTheme.css";
import { useAuth } from "@/_core/hooks/useAuth";
import { siteLanguages, useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { navigateWithTransition } from "@/lib/pageNavigation";
import { loginButtonCopy } from "@/lib/loginButtonCopy";
import { SeoMeta, seoCopy } from "@/components/SeoMeta";

export const plantCatalog = {
  pt: [
    { key: "ginger" as PlantKey, common: "Gengibre", latin: "Zingiber officinale", tone: "ginger", focus: "Raiz aromática frequentemente investigada em contextos de dor e inflamação.", evidence: "Converse com sua equipe sobre a diferença entre dados de dismenorreia e evidência direta em endometriose.", caution: "Pode interagir com medicamentos; não inicie suplementação por conta própria." },
    { key: "chamomile" as PlantKey, common: "Camomila", latin: "Matricaria chamomilla", tone: "chamomile", focus: "Flor tradicionalmente associada a momentos de conforto e relaxamento.", evidence: "A qualidade e a aplicabilidade das fontes devem ser verificadas caso a caso no acervo científico.", caution: "Atenção a alergias e a combinações com outros medicamentos." },
    { key: "turmeric" as PlantKey, common: "Cúrcuma", latin: "Curcuma longa", tone: "turmeric", focus: "Rizoma de cor intensa estudado por seus compostos bioativos.", evidence: "Converse com um profissional para contextualizar estudos e avaliar a aplicabilidade das informações ao seu caso.", caution: "Pode não ser apropriada em algumas condições clínicas ou com certos fármacos." },
  ],
  en: [
    { key: "ginger" as PlantKey, common: "Ginger", latin: "Zingiber officinale", tone: "ginger", focus: "An aromatic root often investigated in contexts of pain and inflammation.", evidence: "Discuss with your care team the difference between dysmenorrhea data and direct evidence in endometriosis.", caution: "It may interact with medicines; do not start supplements on your own." },
    { key: "chamomile" as PlantKey, common: "Chamomile", latin: "Matricaria chamomilla", tone: "chamomile", focus: "A flower traditionally associated with moments of comfort and relaxation.", evidence: "The quality and applicability of sources should be checked case by case in the scientific collection.", caution: "Pay attention to allergies and combinations with other medicines." },
    { key: "turmeric" as PlantKey, common: "Turmeric", latin: "Curcuma longa", tone: "turmeric", focus: "A richly colored rhizome studied for its bioactive compounds.", evidence: "Talk with a professional to put studies in context and assess how information applies to your situation.", caution: "It may not be appropriate in some clinical conditions or alongside certain medicines." },
  ],
  es: [
    { key: "ginger" as PlantKey, common: "Jengibre", latin: "Zingiber officinale", tone: "ginger", focus: "Raíz aromática investigada con frecuencia en contextos de dolor e inflamación.", evidence: "Habla con tu equipo sobre la diferencia entre datos de dismenorrea y evidencia directa en endometriosis.", caution: "Puede interactuar con medicamentos; no inicies suplementos por tu cuenta." },
    { key: "chamomile" as PlantKey, common: "Manzanilla", latin: "Matricaria chamomilla", tone: "chamomile", focus: "Flor tradicionalmente asociada con momentos de comodidad y relajación.", evidence: "La calidad y la aplicabilidad de las fuentes deben verificarse caso por caso en el acervo científico.", caution: "Presta atención a alergias y a combinaciones con otros medicamentos." },
    { key: "turmeric" as PlantKey, common: "Cúrcuma", latin: "Curcuma longa", tone: "turmeric", focus: "Rizoma de color intenso estudiado por sus compuestos bioactivos.", evidence: "Habla con un profesional para contextualizar estudios y valorar cómo se aplica la información a tu situación.", caution: "Puede no ser adecuada en algunas condiciones clínicas o junto con ciertos medicamentos." },
  ],
} as const;

export const videoGuideCopy = {
  pt: {
    title: <>Conheça o EndoCare: informação que <em>acolhe</em>.</>,
    text: "Uma apresentação breve da plataforma EndoCare, criada para aproximar informação clara e ferramentas de cuidado de quem convive com endometriose.",
    metadata: "10 s · vídeo de apresentação",
    toplineMetadata: "Apresentação",
    transcript: "Conheça a plataforma",
    points: ["Encontre conteúdos informativos sobre endometriose.", "Explore ferramentas para organizar sintomas e preparar conversas de cuidado.", "Use informações como apoio, sem substituir a orientação profissional."],
    notice: "O EndoCare compartilha conteúdo informativo. Não substitui avaliação, diagnóstico ou acompanhamento profissional.",
    sources: "Fontes sobre endometriose",
    sourceItems: ["OMS", "Ministério da Saúde — Endometriose", "ESHRE", "Ministério da Saúde — Fitoterápicos"],
    audioNote: "Use os controles do vídeo para ativar ou silenciar o áudio.",
    fallback: "Seu navegador não suporta a reprodução deste vídeo.",
  },
  en: {
    title: <>Meet EndoCare: information that <em>welcomes</em>.</>,
    text: "A short introduction to EndoCare, a platform bringing clear information and care tools closer to people living with endometriosis.",
    metadata: "10 sec · platform introduction",
    toplineMetadata: "Introduction",
    transcript: "Explore the platform",
    points: ["Find informational content about endometriosis.", "Explore tools to organize symptoms and prepare for care conversations.", "Use information as support, not as a replacement for professional guidance."],
    notice: "EndoCare provides informational content. It does not replace professional assessment, diagnosis or follow-up.",
    sources: "Endometriosis sources",
    sourceItems: ["WHO", "Brazilian Ministry of Health — Endometriosis", "ESHRE", "Brazilian Ministry of Health — Herbal medicines"],
    audioNote: "Use the video controls to turn the audio on or off.",
    fallback: "Your browser does not support video playback.",
  },
  es: {
    title: <>Conoce EndoCare: información que <em>acoge</em>.</>,
    text: "Una breve presentación de la plataforma EndoCare, que acerca información clara y herramientas de cuidado a quienes conviven con endometriosis.",
    metadata: "10 s · presentación de la plataforma",
    toplineMetadata: "Presentación",
    transcript: "Conoce la plataforma",
    points: ["Encuentra contenido informativo sobre endometriosis.", "Explora herramientas para organizar síntomas y preparar conversaciones de cuidado.", "Usa la información como apoyo, sin sustituir la orientación profesional."],
    notice: "EndoCare ofrece contenido informativo. No sustituye la evaluación, el diagnóstico ni el seguimiento profesional.",
    sources: "Fuentes sobre endometriosis",
    sourceItems: ["OMS", "Ministerio de Salud de Brasil — Endometriosis", "ESHRE", "Ministerio de Salud de Brasil — Fitoterápicos"],
    audioNote: "Usa los controles del video para activar o silenciar el audio.",
    fallback: "Tu navegador no admite la reproducción de este video.",
  },
} as const;

const videoSources = [
  "https://www.who.int/news-room/fact-sheets/detail/endometriosis",
  "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/e/endometriose",
  "https://www.eshre.eu/guideline/endometriosis",
  "https://www.gov.br/saude/pt-br/composicao/sectics/plantas-medicinais-e-fitoterapicos",
] as const;

export const homePresentationVideoUrl = "/videos/endocare-apresentacao.mp4";

const chromeCopy = {
  pt: { brandLabel: "Voltar ao início", navLabel: "Navegação principal", menuLabel: "Abrir menu" },
  en: { brandLabel: "Back to the start", navLabel: "Main navigation", menuLabel: "Open menu" },
  es: { brandLabel: "Volver al inicio", navLabel: "Navegación principal", menuLabel: "Abrir menú" },
} as const;

const homeCopy = {
  pt: { safety: "Conteúdo apenas informativo.", safetyRest: "Não recomendamos o uso de plantas, suplementos, medicamentos ou tratamentos sem prescrição médica e acompanhamento de um profissional.", nav: ["Fitoterapia", "Diário", "EndoBot", "Blog", "Relatos"], videoNav: "Saiba mais", questionnaireNav: "Questionário", account: "Configuração da conta", login: "Entrar com e-mail", heroKicker: "Ciência, escuta e cuidado", heroTitle: <>Seu corpo merece ser <em>ouvido</em> com tempo e evidência.</>, heroText: "Uma plataforma de acolhimento para organizar sintomas, encontrar informações claras e cultivar conversas mais informadas sobre endometriose.", diaryCta: "Começar meu diário", plantsCta: "Explorar plantas", trustA: "Acolhimento sem julgamento", trustB: "Informação clara", panelTop: "Jornada de cuidado", panelStatus: "informação responsável", panelTitle: "Contexto para cada conversa de cuidado.", panelText: "Organize registros e chegue mais preparada para dialogar com profissionais.", panelMetrics: [["Diário", "Registros pessoais"], ["Informação", "Leitura orientativa"], ["Relatos", "Com moderação"]], panelFooter: "Sem promessas de cura. Com informação e contexto.", scroll: "Role para descobrir", phytotherapy: "Fitoterapia em perspectiva", phytoTitle: "Veja a planta. Contextualize a evidência.", phytoText: "Interaja com os modelos para observar formas botânicas e use o seu acervo científico para qualificar qualquer conversa sobre uso complementar.", complementary: "Complementar, nunca substitutivo", investigate: "Para investigar", caution: "Atenção", footer: "Site totalmente informativo.", footerRest: "Não recomendamos uso de plantas, suplementos, medicamentos ou tratamentos; qualquer uso deve ocorrer apenas sob prescrição ou recomendação de profissional.", credit: "Desenvolvido por alunos do", back: "Voltar ao topo ↑", language: "Idioma do site" },
  en: { safety: "Informational content only.", safetyRest: "We do not recommend the use of plants, supplements, medicines, or treatments without a medical prescription and professional follow-up.", nav: ["Phytotherapy", "Diary", "EndoBot", "Blog", "Stories"], videoNav: "Learn more", questionnaireNav: "Questionnaire", account: "Account settings", login: "Sign in with email", heroKicker: "Science, listening and care", heroTitle: <>Your body deserves to be <em>heard</em> with time and evidence.</>, heroText: "A welcoming platform to organize symptoms, find clear information, and foster more informed conversations about endometriosis.", diaryCta: "Start my diary", plantsCta: "Explore plants", trustA: "Care without judgment", trustB: "Clear information", panelTop: "Care journey", panelStatus: "responsible information", panelTitle: "Context for every care conversation.", panelText: "Organize records and arrive better prepared to talk with professionals.", panelMetrics: [["Diary", "Personal records"], ["Information", "Guided reading"], ["Stories", "With moderation"]], panelFooter: "No promises of cure. With information and context.", scroll: "Scroll to discover", phytotherapy: "Phytotherapy in perspective", phytoTitle: "See the plant. Put evidence in context.", phytoText: "Interact with the models to observe botanical forms and use your scientific collection to inform any conversation about complementary use.", complementary: "Complementary, never a replacement", investigate: "To explore", caution: "Caution", footer: "A fully informational site.", footerRest: "We do not recommend plants, supplements, medicines, or treatments; any use should only occur with a prescription or professional recommendation.", credit: "Developed by students from", back: "Back to top ↑", language: "Site language" },
  es: { safety: "Contenido únicamente informativo.", safetyRest: "No recomendamos el uso de plantas, suplementos, medicamentos o tratamientos sin prescripción médica y seguimiento profesional.", nav: ["Fitoterapia", "Diario", "EndoBot", "Blog", "Relatos"], videoNav: "Saber más", questionnaireNav: "Cuestionario", account: "Configuración de la cuenta", login: "Entrar con correo", heroKicker: "Ciencia, escucha y cuidado", heroTitle: <>Tu cuerpo merece ser <em>escuchado</em> con tiempo y evidencia.</>, heroText: "Una plataforma de acogida para organizar síntomas, encontrar información clara y favorecer conversaciones más informadas sobre endometriosis.", diaryCta: "Empezar mi diario", plantsCta: "Explorar plantas", trustA: "Acogida sin juicio", trustB: "Información clara", panelTop: "Trayectoria de cuidado", panelStatus: "información responsable", panelTitle: "Contexto para cada conversación de cuidado.", panelText: "Organiza registros y llega mejor preparada para hablar con profesionales.", panelMetrics: [["Diario", "Registros personales"], ["Información", "Lectura guiada"], ["Relatos", "Con moderación"]], panelFooter: "Sin promesas de cura. Con información y contexto.", scroll: "Desplázate para descubrir", phytotherapy: "Fitoterapia en perspectiva", phytoTitle: "Mira la planta. Contextualiza la evidencia.", phytoText: "Interactúa con los modelos para observar formas botánicas y utiliza tu acervo científico para calificar cualquier conversación sobre uso complementario.", complementary: "Complementario, nunca sustitutivo", investigate: "Para investigar", caution: "Atención", footer: "Sitio totalmente informativo.", footerRest: "No recomendamos plantas, suplementos, medicamentos o tratamientos; cualquier uso debe realizarse únicamente con prescripción o recomendación de profesional.", credit: "Desarrollado por alumnos de", back: "Volver arriba ↑", language: "Idioma del sitio" },
} as const;

export const searchGuideCopy = {
  pt: {
    eyebrow: "Para suas buscas e conversas",
    title: <>Informação clara para começar a entender a <em>endometriose</em>.</>,
    intro: "Sintomas como cólicas intensas e dor pélvica merecem escuta. Reunimos caminhos de leitura para você se informar, organizar perguntas e conversar com profissionais de saúde.",
    cards: [
      ["Sintomas e dor pélvica", "Conheça sinais que podem ser levados para uma conversa de cuidado."],
      ["Exames e diagnóstico", "Entenda perguntas frequentes sobre avaliação e exames, sem interpretar resultados."],
      ["Tipos de endometriose", "Leia sobre manifestações como endometriose profunda, intestinal e ovariana."],
      ["Fertilidade e vida cotidiana", "Encontre informação educativa sobre rotina, planejamento e acolhimento."],
    ],
    faq: "Ver perguntas frequentes",
    blog: "Ler conteúdos educativos",
    note: "Informação educativa não substitui consulta, diagnóstico, prescrição ou atendimento de urgência.",
  },
  en: {
    eyebrow: "For your searches and conversations",
    title: <>Clear information to start understanding <em>endometriosis</em>.</>,
    intro: "Symptoms such as intense cramps and pelvic pain deserve to be heard. We bring together reading paths to help you learn, organize questions, and speak with health professionals.",
    cards: [
      ["Symptoms and pelvic pain", "Learn about signs that can be brought to a care conversation."],
      ["Tests and diagnosis", "Understand common questions about assessment and tests, without interpreting results."],
      ["Types of endometriosis", "Read about manifestations such as deep, bowel, and ovarian endometriosis."],
      ["Fertility and everyday life", "Find educational information about routine, planning, and support."],
    ],
    faq: "See frequently asked questions",
    blog: "Read educational content",
    note: "Educational information does not replace a consultation, diagnosis, prescription, or emergency care.",
  },
  es: {
    eyebrow: "Para tus búsquedas y conversaciones",
    title: <>Información clara para empezar a entender la <em>endometriosis</em>.</>,
    intro: "Síntomas como cólicos intensos y dolor pélvico merecen ser escuchados. Reunimos rutas de lectura para informarte, organizar preguntas y conversar con profesionales de salud.",
    cards: [
      ["Síntomas y dolor pélvico", "Conoce señales que pueden llevarse a una conversación de cuidado."],
      ["Exámenes y diagnóstico", "Comprende dudas frecuentes sobre evaluación y exámenes, sin interpretar resultados."],
      ["Tipos de endometriosis", "Lee sobre manifestaciones como endometriosis profunda, intestinal y ovárica."],
      ["Fertilidad y vida cotidiana", "Encuentra información educativa sobre rutina, planificación y acogida."],
    ],
    faq: "Ver preguntas frecuentes",
    blog: "Leer contenidos educativos",
    note: "La información educativa no sustituye consulta, diagnóstico, prescripción ni atención de urgencia.",
  },
} as const;

export default function Home() {
  const [activePlant, setActivePlant] = useState<PlantKey>("turmeric");
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { language, setLanguage } = useSiteLanguage();
  const t = homeCopy[language];
  const seo = seoCopy[language];
  const video = videoGuideCopy[language];
  const plants = plantCatalog[language];
  const chrome = chromeCopy[language];
  const loginButtonLabel = loginButtonCopy[language];
  const searchGuide = searchGuideCopy[language];
  const selected = plants.find((plant) => plant.key === activePlant) ?? plants[2];

  const jumpTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openDiary = () => {
    setMenuOpen(false);
    navigateWithTransition("/diario");
  };

  return (
    <div className="site-root">
      <SeoMeta title={seo.homeTitle} description={seo.homeDescription} path="/" />
      <MotionSystem />
      <aside className="safety-banner" role="note" aria-label={t.safety}><ShieldAlert size={14} /><span><strong>{t.safety}</strong> {t.safetyRest}</span></aside>
      <header className="topbar">
        <button className="brand" onClick={() => jumpTo("inicio")} aria-label={chrome.brandLabel}><span className="brand-mark"><EndoAcolheMark size={28} /></span><span>EndoCare</span></button>
        <nav className={menuOpen ? "topnav open" : "topnav"} aria-label={chrome.navLabel}><button onClick={() => jumpTo("fitoterapia")}>{t.nav[0]}</button><button onClick={openDiary}>{t.nav[1]}</button><button onClick={() => jumpTo("endobot")}>{t.nav[2]}</button><button onClick={() => jumpTo("saiba-mais")}>{t.videoNav}</button><button onClick={() => { setMenuOpen(false); navigateWithTransition("/questionario"); }}>{t.questionnaireNav}</button><button onClick={() => { setMenuOpen(false); navigateWithTransition("/blog"); }}>{t.nav[3]}</button><button onClick={() => jumpTo("relatos")}>{t.nav[4]}</button><MobileMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={loginButtonLabel} actionsLabel={chrome.navLabel} onAccountClick={() => { setMenuOpen(false); window.dispatchEvent(new Event("endoacolhe:open-account-settings")); }} /></nav>
        <div className="topbar-utility-controls">
          <label className="site-language-select"><Globe2 size={15} /><span className="sr-only">{t.language}</span><select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} aria-label={t.language}>{siteLanguages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <DesktopMenuActions isAuthenticated={isAuthenticated} user={user} accountLabel={t.account} loginLabel={loginButtonLabel} onAccountClick={() => window.dispatchEvent(new Event("endoacolhe:open-account-settings"))} />
        </div>
        <button className="menu-button" aria-label={chrome.menuLabel} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
      </header>
      <main>
        <section id="inicio" className="hero-section">
          <div className="hero-copy">
            <h1>{t.heroTitle}</h1>
            <p>{t.heroText}</p>
            <div className="hero-actions"><button className="primary-button" onClick={openDiary}>{t.diaryCta} <ArrowRight size={17} /></button><button className="text-button" onClick={() => jumpTo("fitoterapia")}><Flower2 size={17} /> {t.plantsCta}</button></div>
            <div className="hero-trust"><span><HeartHandshake size={16} /> {t.trustA}</span><span><BookOpen size={16} /> {t.trustB}</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true"><div className="clinical-hero-panel"><div className="clinical-hero-top"><span>{t.panelTop}</span><span className="clinical-status">{t.panelStatus}</span></div><div className="clinical-hero-main"><h3>{t.panelTitle}</h3><p>{t.panelText}</p><div className="clinical-metrics">{t.panelMetrics.map(([title, detail]) => <div key={title}><strong>{title}</strong><span>{detail}</span></div>)}</div></div><div className="clinical-hero-footer"><ShieldCheck size={17} /><span>{t.panelFooter}</span></div></div></div>
          <button className="scroll-cue" onClick={() => jumpTo("fitoterapia")} aria-label={t.phytotherapy}><span>{t.scroll}</span><ArrowDown size={15} /></button>
        </section>

        <section id="fitoterapia" className="section-shell phytotherapy-section">
          <div className="section-heading split-heading"><div><span className="eyebrow"><Flower2 size={14} /> {t.phytotherapy}</span><h2>{t.phytoTitle}</h2><p>{t.phytoText}</p></div><div className="evidence-pill"><span></span> {t.complementary}</div></div>
          <div className="phytotherapy-layout">
            <div className="plant-selector">{plants.map((plant, index) => <button className={activePlant === plant.key ? `plant-card active ${plant.tone}` : `plant-card ${plant.tone}`} key={plant.key} onClick={() => setActivePlant(plant.key)}><span className="plant-index">0{index + 1}</span><strong>{plant.common}</strong><em>{plant.latin}</em><span className="card-arrow">↗</span></button>)}</div>
            <div className="plant-showcase glass-panel"><div className="showcase-copy"><span className="plant-label">{selected.common}</span><h3>{selected.latin}</h3><p>{selected.focus}</p><div className="evidence-block"><span>{t.investigate}</span><p>{selected.evidence}</p></div><div className="caution-block"><span>{t.caution}</span><p>{selected.caution}</p></div></div><BotanicalViewer plant={activePlant} /></div>
          </div>
        </section>
        <section id="guia-endometriose" className="section-shell search-guide-section" aria-labelledby="search-guide-title">
          <div className="search-guide-heading">
            <span className="eyebrow"><BookOpen size={14} /> {searchGuide.eyebrow}</span>
            <h2 id="search-guide-title">{searchGuide.title}</h2>
            <p>{searchGuide.intro}</p>
          </div>
          <div className="search-guide-grid">
            {searchGuide.cards.map(([title, description], index) => <article className="search-guide-card" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
          <div className="search-guide-footer">
            <p><ShieldCheck size={16} /> {searchGuide.note}</p>
            <div><button className="primary-button" onClick={() => navigateWithTransition("/faq")}>{searchGuide.faq} <ArrowRight size={17} /></button><button className="text-button" onClick={() => navigateWithTransition("/blog")}>{searchGuide.blog}</button></div>
          </div>
        </section>
        <EndoBotPanel />
        <section id="saiba-mais" className="section-shell video-guide-section" aria-labelledby="video-guide-title">
          <div className="video-guide-layout">
            <div className="video-surface">
          <div className="video-surface-topline"><span><CirclePlay size={15} /> EndoCare</span><span>{video.toplineMetadata}</span></div>
              <video className="educational-video" controls preload="metadata" playsInline aria-describedby="video-guide-audio-note video-guide-notice">
                <source src={homePresentationVideoUrl} type="video/mp4" />
                {video.fallback}
              </video>
              <p className="video-audio-note" id="video-guide-audio-note"><Captions size={15} /> {video.audioNote}</p>
            </div>
            <div className="video-guide-copy">
              <h2 id="video-guide-title">{video.title}</h2>
              <p className="video-guide-intro">{video.text}</p>
              <div className="video-guide-metadata"><CirclePlay size={16} /><span>{video.metadata}</span></div>
              <div id="video-libras-guide">
                <h3>{video.transcript}</h3>
                <ol className="video-guide-points">{video.points.map((point) => <li key={point}>{point}</li>)}</ol>
              </div>
              <p className="video-guide-notice" id="video-guide-notice"><ShieldCheck size={16} /> {video.notice}</p>
              <details className="video-sources">
                <summary>{video.sources}</summary>
                <ul>{video.sourceItems.map((label, index) => <li key={label}><a href={videoSources[index]} target="_blank" rel="noreferrer">{label} <ExternalLink size={12} aria-hidden="true" /></a></li>)}</ul>
              </details>
            </div>
          </div>
        </section>
        <BlogAndCommunity />
      </main>
      <footer className="site-footer"><div className="brand"><span className="brand-mark"><EndoAcolheMark size={26} /></span><span>EndoCare</span></div><p><strong>{t.footer}</strong> {t.footerRest}</p><p className="school-credit">{t.credit} <strong>SESI</strong>.</p><SiteCopyright /><button onClick={() => jumpTo("inicio")}>{t.back}</button></footer>
      <AccountSettingsDialog />
    </div>
  );
}
