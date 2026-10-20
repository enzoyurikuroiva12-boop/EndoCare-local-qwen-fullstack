import { useEffect, useState } from "react";
import { CheckCircle2, HeartHandshake, MessageCircleHeart, Send, Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import { resolveBrowserApiBaseUrl } from "@/lib/apiBase";
import { useAccountControl } from "@/contexts/AccountControlContext";
import { blocksRestrictedFeatures } from "@/lib/accountControl";
import "./BlogAndCommunity.css";

const apiBase = resolveBrowserApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

type Story = { id: string; author_alias: string; content: string; helpfulness: number };

export const blogCopy = {
  pt: {
    loadError: "Não foi possível carregar relatos agora.",
    submitSuccess: "Seu relato foi enviado para revisão.",
    submitError: "Não foi possível enviar o relato agora. Tente novamente.",
    submitting: "Verificando…",
    blogEyebrow: "Blog informativo",
    blogTitle: "Informação para apoiar boas perguntas.",
    blogIntro: "Conteúdos educativos para organizar dúvidas e ampliar o diálogo com profissionais. O EndoCare não recomenda tratamentos, produtos, doses ou plantas.",
    professional: "Uso somente com orientação",
    professionalStrong: "de profissional.",
    read: "Ler orientação",
    comingSoon: "Artigo completo em breve. Converse com sua equipe de saúde.",
    storiesEyebrow: "Relatos da comunidade",
    storiesTitle: "Experiências reais, com contexto e respeito.",
    storiesIntro: "Esta área aceita apenas relatos enviados voluntariamente e publicados após revisão. Não criamos, compramos ou simulamos depoimentos.",
    review: "Publicação condicionada",
    reviewStrong: "a revisão e consentimento.",
    published: "Relatos publicados",
    publishedDescription: "Experiências pessoais não comprovam eficácia nem substituem orientação clínica.",
    loading: "Carregando relatos revisados…",
    filtersLabel: "Filtros de relatos",
    search: "Buscar história",
    searchPlaceholder: "Apelido ou palavra do relato",
    ratingLabel: "Filtrar por avaliação",
    helpfulness: "Quanto pareceu ajudar",
    filters: { all: "Todas", low: "0–2", mid: "3–4", high: "5 estrelas" },
    result: (count: number) => `${count} relato${count === 1 ? "" : "s"} encontrado${count === 1 ? "" : "s"}.`,
    stars: (value: number) => `${value} de 5 estrelas`,
    noResults: "Nenhum relato corresponde a estes filtros.",
    clear: "Limpar filtros",
    emptyTitle: "Ainda não há relatos publicados.",
    emptyText: "Quando houver histórias reais, consentidas e revisadas, elas aparecerão aqui.",
    formTitle: "Compartilhe um relato real",
    formIntro: "Evite dados pessoais, diagnósticos, prescrições, promessas de resultado ou instruções de uso.",
    login: "Entrar para enviar um relato",
    alias: "Como prefere ser identificada?",
    aliasPlaceholder: "Ex.: Ana, 24",
    story: "Seu relato",
    storyPlaceholder: "Conte, com suas palavras, como foi sua experiência…",
    ratingQuestion: "De 0 a 5, quanto esta experiência pareceu ajudar você?",
    starChoice: (value: number) => `${value} estrelas`,
    consent: "Confirmo que este relato é meu, não contém dados pessoais de terceiros e poderá ser publicado somente após revisão.",
    send: "Enviar para revisão",
    characters: (count: number) => `${count}/1600 caracteres`,
    restricted: "Sua conta está Restrita. Por favor, contate um administrador para saber o motivo.",
    posts: [
      { category: "Leitura guiada", title: "Como ler uma fonte científica com mais calma", summary: "Um roteiro de perguntas para distinguir objetivo, limites e aplicabilidade de um estudo antes de levá-lo para uma conversa clínica." },
      { category: "Consulta", title: "Perguntas que ajudam a organizar sua próxima conversa", summary: "Use o diário, suas dúvidas e referências verificáveis para registrar o que você gostaria de conversar com um profissional." },
      { category: "Autocuidado informado", title: "Informação não é recomendação de tratamento", summary: "Conhecer uma planta ou uma prática não significa que ela seja adequada para você. A decisão deve ser individual e profissional." },
    ],
  },
  en: {
    loadError: "Stories cannot be loaded right now.",
    submitSuccess: "Your story was sent for review.",
    submitError: "The story could not be sent right now. Please try again.",
    submitting: "Checking…",
    blogEyebrow: "Informational blog",
    blogTitle: "Information to support better questions.",
    blogIntro: "Educational content to organize questions and expand dialogue with professionals. EndoCare does not recommend treatments, products, dosages, or plants.",
    professional: "Use only with guidance",
    professionalStrong: "from a professional.",
    read: "Read guidance",
    comingSoon: "Full article coming soon. Talk to your healthcare team.",
    storiesEyebrow: "Community stories",
    storiesTitle: "Real experiences, with context and respect.",
    storiesIntro: "This area accepts only stories submitted voluntarily and published after review. We do not create, buy, or simulate testimonials.",
    review: "Publication depends on",
    reviewStrong: "review and consent.",
    published: "Published stories",
    publishedDescription: "Personal experiences do not prove effectiveness and do not replace clinical guidance.",
    loading: "Loading reviewed stories…",
    filtersLabel: "Story filters",
    search: "Search stories",
    searchPlaceholder: "Alias or word from a story",
    ratingLabel: "Filter by rating",
    helpfulness: "How helpful it seemed",
    filters: { all: "All", low: "0–2", mid: "3–4", high: "5 stars" },
    result: (count: number) => `${count} stor${count === 1 ? "y" : "ies"} found.`,
    stars: (value: number) => `${value} out of 5 stars`,
    noResults: "No stories match these filters.",
    clear: "Clear filters",
    emptyTitle: "There are no published stories yet.",
    emptyText: "When real, consented, and reviewed stories are available, they will appear here.",
    formTitle: "Share a real story",
    formIntro: "Avoid personal data, diagnoses, prescriptions, promises of results, or directions for use.",
    login: "Sign in to submit a story",
    alias: "How would you like to be identified?",
    aliasPlaceholder: "E.g.: Ana, 24",
    story: "Your story",
    storyPlaceholder: "In your own words, tell us about your experience…",
    ratingQuestion: "From 0 to 5, how helpful did this experience seem to you?",
    starChoice: (value: number) => `${value} stars`,
    consent: "I confirm that this story is mine, contains no third-party personal data, and may be published only after review.",
    send: "Send for review",
    characters: (count: number) => `${count}/1600 characters`,
    restricted: "Your account is restricted. Please contact an administrator to learn why.",
    posts: [
      { category: "Guided reading", title: "How to read a scientific source more calmly", summary: "A set of questions to distinguish the purpose, limits, and applicability of a study before taking it to a clinical conversation." },
      { category: "Appointment", title: "Questions that help organize your next conversation", summary: "Use your diary, questions, and verifiable references to note what you would like to discuss with a professional." },
      { category: "Informed self-care", title: "Information is not a treatment recommendation", summary: "Knowing a plant or practice does not mean it is appropriate for you. The decision must be individual and professional." },
    ],
  },
  es: {
    loadError: "No es posible cargar los relatos en este momento.",
    submitSuccess: "Tu relato fue enviado para revisión.",
    submitError: "No fue posible enviar el relato ahora. Inténtalo de nuevo.",
    submitting: "Verificando…",
    blogEyebrow: "Blog informativo",
    blogTitle: "Información para apoyar mejores preguntas.",
    blogIntro: "Contenidos educativos para organizar dudas y ampliar el diálogo con profesionales. EndoCare no recomienda tratamientos, productos, dosis ni plantas.",
    professional: "Uso solo con orientación",
    professionalStrong: "de un profesional.",
    read: "Leer orientación",
    comingSoon: "El artículo completo estará disponible pronto. Habla con tu equipo de salud.",
    storiesEyebrow: "Relatos de la comunidad",
    storiesTitle: "Experiencias reales, con contexto y respeto.",
    storiesIntro: "Esta área solo acepta relatos enviados voluntariamente y publicados después de una revisión. No creamos, compramos ni simulamos testimonios.",
    review: "Publicación condicionada",
    reviewStrong: "a revisión y consentimiento.",
    published: "Relatos publicados",
    publishedDescription: "Las experiencias personales no demuestran eficacia ni sustituyen la orientación clínica.",
    loading: "Cargando relatos revisados…",
    filtersLabel: "Filtros de relatos",
    search: "Buscar historia",
    searchPlaceholder: "Alias o palabra del relato",
    ratingLabel: "Filtrar por valoración",
    helpfulness: "Cuánto pareció ayudar",
    filters: { all: "Todos", low: "0–2", mid: "3–4", high: "5 estrellas" },
    result: (count: number) => `${count} relato${count === 1 ? "" : "s"} encontrado${count === 1 ? "" : "s"}.`,
    stars: (value: number) => `${value} de 5 estrellas`,
    noResults: "Ningún relato coincide con estos filtros.",
    clear: "Limpiar filtros",
    emptyTitle: "Aún no hay relatos publicados.",
    emptyText: "Cuando haya historias reales, consentidas y revisadas, aparecerán aquí.",
    formTitle: "Comparte un relato real",
    formIntro: "Evita datos personales, diagnósticos, prescripciones, promesas de resultados o instrucciones de uso.",
    login: "Inicia sesión para enviar un relato",
    alias: "¿Cómo prefieres ser identificada?",
    aliasPlaceholder: "Ej.: Ana, 24",
    story: "Tu relato",
    storyPlaceholder: "Con tus palabras, cuéntanos cómo fue tu experiencia…",
    ratingQuestion: "De 0 a 5, ¿cuánto pareció ayudarte esta experiencia?",
    starChoice: (value: number) => `${value} estrellas`,
    consent: "Confirmo que este relato es mío, no contiene datos personales de terceros y podrá publicarse únicamente después de una revisión.",
    send: "Enviar para revisión",
    characters: (count: number) => `${count}/1600 caracteres`,
    restricted: "Tu cuenta está restringida. Contacta a una persona administradora para saber el motivo.",
    posts: [
      { category: "Lectura guiada", title: "Cómo leer una fuente científica con más calma", summary: "Una guía de preguntas para distinguir el objetivo, los límites y la aplicabilidad de un estudio antes de llevarlo a una conversación clínica." },
      { category: "Consulta", title: "Preguntas que ayudan a organizar tu próxima conversación", summary: "Usa el diario, tus dudas y referencias verificables para registrar lo que te gustaría hablar con un profesional." },
      { category: "Autocuidado informado", title: "La información no es una recomendación de tratamiento", summary: "Conocer una planta o una práctica no significa que sea adecuada para ti. La decisión debe ser individual y profesional." },
    ],
  },
} as const;

export function BlogAndCommunity() {
  const { isAuthenticated, user } = useAuth();
  const { language, locale } = useSiteLanguage();
  const { control } = useAccountControl();
  const t = blogCopy[language];
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [alias, setAlias] = useState("");
  const [story, setStory] = useState("");
  const [helpfulness, setHelpfulness] = useState(0);
  const [consent, setConsent] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "mid" | "high">("all");
  const [submitting, setSubmitting] = useState(false);

  const loadStories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("community_stories")
      .select("id,author_alias,content,helpfulness")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) toast.error(t.loadError);
    else setStories((data ?? []) as Story[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadStories();
    const channel = supabase
      .channel("community-stories-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_stories" }, () => void loadStories())
      .subscribe();
    // The list is not language-dependent; copying strings is handled at render time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isAuthenticated && blocksRestrictedFeatures(control)) return toast.error(t.restricted);
    if (!user || helpfulness < 0 || submitting) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return toast.error(t.submitError);
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/report-triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alias, content: story, helpfulness, consentToPublish: consent }),
      });
      const result = await response.json().catch(() => null) as { submitted?: boolean } | null;
      if (!response.ok || !result?.submitted) return toast.error(t.submitError);
      toast.success(t.submitSuccess);
    } catch {
      toast.error(t.submitError);
    } finally {
      setSubmitting(false);
    }
    setAlias("");
    setStory("");
    setHelpfulness(0);
    setConsent(false);
  }

  const normalized = query.trim().toLocaleLowerCase(locale);
  const filtered = stories.filter((item) => (
    (!normalized || `${item.author_alias} ${item.content}`.toLocaleLowerCase(locale).includes(normalized))
    && (filter === "all" || (filter === "low" && item.helpfulness <= 2) || (filter === "mid" && item.helpfulness >= 3 && item.helpfulness <= 4) || (filter === "high" && item.helpfulness === 5))
  ));

  return (
      <section id="relatos" className="section-shell community-section">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow"><MessageCircleHeart size={14} /> {t.storiesEyebrow}</span>
            <h2>{t.storiesTitle}</h2>
            <p>{t.storiesIntro}</p>
          </div>
          <div className="review-badge"><CheckCircle2 size={18} /><span>{t.review}<br /><strong>{t.reviewStrong}</strong></span></div>
        </div>

        <div className="community-layout">
          <div className="stories-panel glass-panel">
            <div className="stories-title">
              <b className="published-story-count" aria-label={t.result(stories.length)}>{stories.length}</b>
              <HeartHandshake size={20} />
              <div><strong>{t.published}</strong><small>{t.publishedDescription}</small></div>
            </div>

            {loading ? <p className="community-empty">{t.loading}</p> : stories.length ? (
              <>
                <div className="story-filters" aria-label={t.filtersLabel}>
                  <label className="story-search"><span>{t.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} /></label>
                  <div className="rating-filters" role="group" aria-label={t.ratingLabel}>
                    <span>{t.helpfulness}</span>
                    <div>{(["all", "low", "mid", "high"] as const).map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t.filters[value]}</button>)}</div>
                  </div>
                </div>
                <p className="story-filter-result" aria-live="polite">{t.result(filtered.length)}</p>
                {filtered.length ? <div className="story-list">{filtered.map((item) => <article className="real-story" key={item.id}><div><strong>{item.author_alias}</strong><span className="story-stars" aria-label={t.stars(item.helpfulness)}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < item.helpfulness ? "currentColor" : "none"} />)}</span></div><p>{item.content}</p></article>)}</div> : <div className="community-filter-empty"><MessageCircleHeart size={23} /><p>{t.noResults}</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>{t.clear}</button></div>}
              </>
            ) : <div className="community-empty"><MessageCircleHeart size={27} /><p><strong>{t.emptyTitle}</strong><br />{t.emptyText}</p></div>}
          </div>

          <form className="story-form glass-panel" onSubmit={submit}>
            <h3>{t.formTitle}</h3>
            <p>{t.formIntro}</p>
            {!isAuthenticated ? <button className="primary-button" type="button" onClick={startLogin}>{t.login}</button> : blocksRestrictedFeatures(control) ? <p className="story-restricted-notice" role="alert">{t.restricted}</p> : <>
              <label>{t.alias}<input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={t.aliasPlaceholder} maxLength={80} required /></label>
              <label>{t.story}<textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder={t.storyPlaceholder} minLength={40} maxLength={1600} rows={5} required /><small className="story-character-count">{t.characters(story.length)}</small></label>
              <fieldset className="star-field"><legend>{t.ratingQuestion}</legend><div>{Array.from({ length: 5 }, (_, index) => { const value = index + 1; return <button type="button" className={value <= helpfulness ? "star-choice active" : "star-choice"} onClick={() => setHelpfulness(value)} key={value} aria-label={t.starChoice(value)}><Star size={23} fill={value <= helpfulness ? "currentColor" : "none"} /></button>; })}<button type="button" className={helpfulness === 0 ? "zero-choice active" : "zero-choice"} onClick={() => setHelpfulness(0)}>0</button></div></fieldset>
              <label className="consent-field"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>{t.consent}</span></label>
              <button className="primary-button" type="submit" disabled={submitting}><Send size={16} /> {submitting ? t.submitting : t.send}</button>
            </>}
          </form>
        </div>
      </section>
  );
}
