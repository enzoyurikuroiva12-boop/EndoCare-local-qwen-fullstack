import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, LoaderCircle, Send, ShieldCheck, Star, Timer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import "./Questionnaire.css";

export type QuestionnaireQuestion = {
  id: string;
  prompt_pt: string;
  prompt_en: string | null;
  prompt_es: string | null;
  helper_pt: string | null;
  helper_en: string | null;
  helper_es: string | null;
  is_required: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type QuestionnaireStatus = {
  can_submit: boolean;
  next_available_at: string | null;
  last_response_at: string | null;
};

const questionnaireCopy = {
  pt: {
    eyebrow: "Questionário de experiência",
    title: "Ajude a cuidar do próximo passo.",
    intro: "Conte como foi sua experiência no EndoCare. Suas respostas ajudam a orientar melhorias sem substituir nenhuma conversa de cuidado.",
    privacy: "Não informe nomes, e-mails, diagnósticos ou outros dados pessoais.",
    loginRequired: "Entre para responder uma vez por semana.",
    loginRequiredDetail: "O limite precisa estar ligado à sua conta para evitar contornos pelo navegador.",
    loginAction: "Entrar para responder",
    checkingLimit: "Verificando seu limite semanal…",
    weeklyLimit: "Você já respondeu nesta semana. Um administrador pode liberar um novo envio antes dos 7 dias, se necessário.",
    availableOn: (value: string) => `Novo envio disponível em ${value}.`,
    loading: "Carregando perguntas…",
    loadError: "Não foi possível carregar o questionário agora.",
    empty: "Ainda não há perguntas abertas, mas você já pode avaliar sua experiência.",
    required: "Obrigatória",
    optional: "Opcional",
    ratingLegend: "Como você avalia sua experiência no EndoCare?",
    ratingHint: "Escolha de 1 a 5 estrelas.",
    ratingLabel: (value: number) => `${value} de 5 estrelas`,
    responsePlaceholder: "Escreva sua resposta…",
    send: "Enviar respostas",
    sending: "Enviando…",
    successTitle: "Obrigada por compartilhar.",
    successText: "Sua avaliação foi registrada e será usada apenas para entender como melhorar o site.",
    answerAgain: "Responder novamente",
    submittedRating: (value: number) => `Sua avaliação: ${value} de 5 estrelas`,
  },
  en: {
    eyebrow: "Experience questionnaire",
    title: "Help us care for the next step.",
    intro: "Tell us about your EndoCare experience. Your answers help guide improvements without replacing any care conversation.",
    privacy: "Do not include names, emails, diagnoses, or other personal information.",
    loginRequired: "Sign in to answer once per week.",
    loginRequiredDetail: "The limit is linked to your account so it cannot be bypassed in the browser.",
    loginAction: "Sign in to answer",
    checkingLimit: "Checking your weekly limit…",
    weeklyLimit: "You have already answered this week. An administrator can release a new submission before 7 days if needed.",
    availableOn: (value: string) => `New submission available on ${value}.`,
    loading: "Loading questions…",
    loadError: "The questionnaire could not be loaded right now.",
    empty: "There are no open questions yet, but you can already rate your experience.",
    required: "Required",
    optional: "Optional",
    ratingLegend: "How would you rate your EndoCare experience?",
    ratingHint: "Choose from 1 to 5 stars.",
    ratingLabel: (value: number) => `${value} out of 5 stars`,
    responsePlaceholder: "Write your answer…",
    send: "Send answers",
    sending: "Sending…",
    successTitle: "Thank you for sharing.",
    successText: "Your rating was recorded and will only be used to understand how to improve the site.",
    answerAgain: "Answer again",
    submittedRating: (value: number) => `Your rating: ${value} out of 5 stars`,
  },
  es: {
    eyebrow: "Cuestionario de experiencia",
    title: "Ayúdanos a cuidar el siguiente paso.",
    intro: "Cuéntanos cómo fue tu experiencia en EndoCare. Tus respuestas ayudan a orientar mejoras sin sustituir ninguna conversación de cuidado.",
    privacy: "No incluyas nombres, correos, diagnósticos ni otros datos personales.",
    loginRequired: "Entra para responder una vez por semana.",
    loginRequiredDetail: "El límite está ligado a tu cuenta para evitar que se salte desde el navegador.",
    loginAction: "Entrar para responder",
    checkingLimit: "Verificando tu límite semanal…",
    weeklyLimit: "Ya respondiste esta semana. Una persona administradora puede liberar un nuevo envío antes de 7 días si es necesario.",
    availableOn: (value: string) => `Nuevo envío disponible el ${value}.`,
    loading: "Cargando preguntas…",
    loadError: "No fue posible cargar el cuestionario ahora.",
    empty: "Todavía no hay preguntas abiertas, pero ya puedes valorar tu experiencia.",
    required: "Obligatoria",
    optional: "Opcional",
    ratingLegend: "¿Cómo valoras tu experiencia en EndoCare?",
    ratingHint: "Elige de 1 a 5 estrellas.",
    ratingLabel: (value: number) => `${value} de 5 estrellas`,
    responsePlaceholder: "Escribe tu respuesta…",
    send: "Enviar respuestas",
    sending: "Enviando…",
    successTitle: "Gracias por compartir.",
    successText: "Tu valoración fue registrada y solo se utilizará para entender cómo mejorar el sitio.",
    answerAgain: "Responder de nuevo",
    submittedRating: (value: number) => `Tu valoración: ${value} de 5 estrellas`,
  },
} as const;

function localizedValue(question: QuestionnaireQuestion, language: "pt" | "en" | "es", field: "prompt" | "helper") {
  const values = {
    pt: question[`${field}_pt`],
    en: question[`${field}_en`],
    es: question[`${field}_es`],
  } as const;
  return values[language] || values.pt || "";
}

const questionFields = "id,prompt_pt,prompt_en,prompt_es,helper_pt,helper_en,helper_es,is_required,is_active,position,created_at,updated_at";

export default function Questionnaire() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { language, locale } = useSiteLanguage();
  const t = questionnaireCopy[language];
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [questionnaireStatus, setQuestionnaireStatus] = useState<QuestionnaireStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  async function loadQuestionnaireStatus() {
    if (!isAuthenticated || !user) {
      setQuestionnaireStatus(null);
      return;
    }
    setStatusLoading(true);
    const { data, error } = await supabase.rpc("get_endoacolhe_questionnaire_status");
    if (!error && data && typeof data === "object" && "can_submit" in data) {
      setQuestionnaireStatus(data as QuestionnaireStatus);
    } else if (error) {
      setQuestionnaireStatus(null);
    }
    setStatusLoading(false);
  }

  async function loadQuestions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("endoacolhe_questionnaire_questions")
      .select(questionFields)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(30);
    if (error) toast.error(t.loadError);
    else setQuestions((data ?? []) as QuestionnaireQuestion[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadQuestions();
    const channel = supabase
      .channel("endoacolhe-questionnaire-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "endoacolhe_questionnaire_questions" }, () => void loadQuestions())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // The question list is independent from the selected language; localized copy changes at render time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadQuestionnaireStatus();
    // O status depende apenas da sessão atual; alterações de idioma mudam somente a apresentação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, user?.id]);

  const weeklyLimitLocked = questionnaireStatus?.can_submit === false;
  const nextAvailableLabel = questionnaireStatus?.next_available_at
    ? new Date(questionnaireStatus.next_available_at).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  function resetForm() {
    setAnswers({});
    setRating(0);
    setSubmitted(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || authLoading || !isAuthenticated || weeklyLimitLocked) return;
    if (rating < 1 || rating > 5) {
      toast.error(t.ratingLegend);
      return;
    }
    const normalizedAnswers = Object.fromEntries(
      questions
        .map((question) => [question.id, (answers[question.id] ?? "").trim()] as const)
        .filter(([, answer]) => answer.length > 0),
    );
    const missingRequired = questions.some((question) => question.is_required && !normalizedAnswers[question.id]);
    if (missingRequired) {
      toast.error(language === "en" ? "Answer every required question before sending." : language === "es" ? "Responde todas las preguntas obligatorias antes de enviar." : "Responda todas as perguntas obrigatórias antes de enviar.");
      return;
    }

    setSending(true);
    const { error } = await supabase.rpc("submit_endoacolhe_questionnaire", {
      p_answers: normalizedAnswers,
      p_rating: rating,
    });
    setSending(false);
    if (error) {
      if (error.code === "P0001") {
        await loadQuestionnaireStatus();
        toast.error(t.weeklyLimit);
      } else if (error.code === "42501" && !isAuthenticated) {
        toast.error(t.loginRequired);
      } else {
        toast.error(language === "en" ? "The answers could not be sent right now." : language === "es" ? "No fue posible enviar las respuestas ahora." : "Não foi possível enviar as respostas agora.");
      }
      return;
    }
    await loadQuestionnaireStatus();
    setSubmitted(true);
    toast.success(t.successTitle);
  }

  return (
    <section id="questionario" className="section-shell questionnaire-section" aria-labelledby="questionnaire-title">
      <div className="questionnaire-heading">
        <div className="questionnaire-intro">
          <span className="eyebrow"><ClipboardList size={14} /> {t.eyebrow}</span>
          <h2 id="questionnaire-title">{t.title}</h2>
          <p>{t.intro}</p>
          <p className="questionnaire-privacy"><ShieldCheck size={16} /> {t.privacy}</p>
        </div>
        <div className="questionnaire-mark" aria-hidden="true"><span>01</span><Star size={26} fill="currentColor" /><strong>escuta<br />que orienta</strong></div>
      </div>

      <div className="questionnaire-card glass-panel">
        {!submitted && !authLoading && !isAuthenticated ? <div className="questionnaire-access-notice" role="note"><ShieldCheck size={18} /><div><strong>{t.loginRequired}</strong><span>{t.loginRequiredDetail}</span><button type="button" className="text-button questionnaire-login-button" onClick={() => startLogin()}>{t.loginAction} <span aria-hidden="true">↗</span></button></div></div> : null}
        {!submitted && isAuthenticated && statusLoading ? <p className="questionnaire-limit-loading" role="status"><LoaderCircle className="questionnaire-spinner" size={16} />{t.checkingLimit}</p> : null}
        {!submitted && isAuthenticated && weeklyLimitLocked ? <div className="questionnaire-limit-notice" role="alert"><Timer size={18} /><div><strong>{t.weeklyLimit}</strong>{nextAvailableLabel ? <span>{t.availableOn(nextAvailableLabel)}</span> : null}</div></div> : null}
        {submitted ? (
          <div className="questionnaire-success" role="status">
            <CheckCircle2 size={32} />
            <h3>{t.successTitle}</h3>
            <p>{t.successText}</p>
            <p className="questionnaire-success-rating">{t.submittedRating(rating)}</p>
            <button type="button" className="text-button" onClick={resetForm}>{t.answerAgain} <span aria-hidden="true">↗</span></button>
          </div>
        ) : (
          <form className="questionnaire-form" onSubmit={submit}>
            <div className="questionnaire-form-head">
              <div><span className="questionnaire-form-kicker">EndoCare</span><h3>{t.eyebrow}</h3></div>
              <span className="questionnaire-form-count">{questions.length.toString().padStart(2, "0")}</span>
            </div>
            {loading ? <div className="questionnaire-loading"><LoaderCircle className="questionnaire-spinner" size={22} /><span>{t.loading}</span></div> : questions.length ? (
              <div className="questionnaire-prompts">
                {questions.map((question, index) => {
                  const prompt = localizedValue(question, language, "prompt");
                  const helper = localizedValue(question, language, "helper");
                  return <label className="questionnaire-prompt" key={question.id}>
                    <span className="questionnaire-prompt-label"><b>{String(index + 1).padStart(2, "0")}</b><span>{prompt}</span><em>{question.is_required ? t.required : t.optional}</em></span>
                    {helper ? <small>{helper}</small> : null}
                    <textarea value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={t.responsePlaceholder} maxLength={1600} rows={3} required={question.is_required} disabled={!isAuthenticated || statusLoading || weeklyLimitLocked} />
                    <small className="questionnaire-character-count">{(answers[question.id] ?? "").length}/1600</small>
                  </label>;
                })}
              </div>
            ) : <p className="questionnaire-empty"><ClipboardList size={20} />{t.empty}</p>}

            <fieldset className="questionnaire-rating">
              <legend>{t.ratingLegend}</legend>
              <small>{t.ratingHint}</small>
              <div className="questionnaire-stars" role="group" aria-label={t.ratingLegend}>
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1;
                  return <button type="button" className={value <= rating ? "questionnaire-star is-active" : "questionnaire-star"} onClick={() => setRating(value)} key={value} aria-label={t.ratingLabel(value)} aria-pressed={value === rating} title={t.ratingLabel(value)} disabled={!isAuthenticated || statusLoading || weeklyLimitLocked}><Star size={28} fill={value <= rating ? "currentColor" : "none"} /></button>;
                })}
              </div>
              <span className="questionnaire-rating-value" aria-live="polite">{rating ? t.ratingLabel(rating) : ""}</span>
            </fieldset>
            <div className="questionnaire-form-footer"><p>{t.privacy}</p><button className="primary-button" type="submit" disabled={sending || loading || authLoading || statusLoading || !isAuthenticated || weeklyLimitLocked}>{sending ? <LoaderCircle className="questionnaire-spinner" size={16} /> : <Send size={16} />}{sending ? t.sending : t.send}</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
