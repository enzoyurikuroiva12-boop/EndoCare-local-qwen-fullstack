import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ClipboardList, Eye, EyeOff, LoaderCircle, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import type { QuestionnaireQuestion } from "./Questionnaire";
import "./QuestionnaireAdmin.css";

const apiBase = import.meta.env.VITE_API_BASE_URL || "https://backendendoacolhe.vercel.app";

type QuestionForm = {
  prompt_pt: string;
  helper_pt: string;
  is_required: boolean;
  is_active: boolean;
  position: string;
};

type QuestionnaireResults = {
  total_responses: number;
  average_rating: number;
  distribution: Array<{ rating: number; count: number }>;
};

type QuestionnaireTranslations = {
  promptEn: string;
  promptEs: string;
  helperEn: string;
  helperEs: string;
};

const emptyForm: QuestionForm = {
  prompt_pt: "",
  helper_pt: "",
  is_required: false,
  is_active: true,
  position: "0",
};

const questionnaireAdminCopy = {
  pt: {
    title: "Questionário e avaliações",
    intro: "Crie perguntas para a área pública e acompanhe a nota geral do site sem abrir respostas individuais.",
    editorTitle: "Perguntas públicas",
    editorIntro: "Preencha em português. O site prepara inglês e espanhol automaticamente ao salvar.",
    newQuestion: "Nova pergunta",
    editQuestion: "Editar pergunta",
    promptPt: "Pergunta em português",
    helperPt: "Orientação em português",
    promptPlaceholder: "Ex.: O que mais ajudou você a encontrar aqui?",
    helperPlaceholder: "Uma orientação curta para quem responde",
    required: "Resposta obrigatória",
    active: "Pergunta visível no site",
    position: "Ordem",
    save: "Salvar pergunta",
    saving: "Salvando…",
    translating: "Traduzindo…",
    cancel: "Cancelar edição",
    edit: "Editar",
    activate: "Ativar",
    deactivate: "Desativar",
    activeLabel: "Ativa",
    inactiveLabel: "Inativa",
    requiredLabel: "Obrigatória",
    optionalLabel: "Opcional",
    automaticTranslation: "Inglês e espanhol são atualizados automaticamente ao salvar esta pergunta.",
    empty: "Ainda não há perguntas cadastradas.",
    resultsTitle: "Avaliações do site",
    resultsIntro: "Visão agregada das notas finais. Nenhuma resposta escrita é exibida neste painel.",
    total: "Avaliações recebidas",
    average: "Média geral",
    distribution: "Distribuição por estrelas",
    stars: (value: number) => `${value} estrela${value === 1 ? "" : "s"}`,
    noResults: "As avaliações aparecerão aqui depois do primeiro envio.",
    loadError: "Não foi possível carregar o questionário agora.",
    saveError: "Não foi possível salvar esta pergunta agora.",
    translationError: "Não foi possível traduzir esta pergunta agora. Tente novamente antes de salvar.",
    saved: "Pergunta salva.",
    updated: "Pergunta atualizada.",
    toggleError: "Não foi possível alterar o status da pergunta.",
    deleteQuestion: "Excluir",
    deleteTitle: "Excluir pergunta",
    deleteDescription: "Esta pergunta será removida da administração e não aparecerá mais no questionário. As avaliações já recebidas não serão alteradas.",
    deleteConfirm: "Excluir pergunta",
    deleteSuccess: "Pergunta excluída.",
    deleteError: "Não foi possível excluir esta pergunta agora.",
    requiredPrompt: "Escreva a pergunta em português antes de salvar.",
    positionError: "A ordem precisa ser um número inteiro igual ou maior que zero.",
  },
  en: {
    title: "Questionnaire and ratings",
    intro: "Create questions for the public area and track the overall site rating without opening individual answers.",
    editorTitle: "Public questions",
    editorIntro: "Fill it in Portuguese. The site prepares English and Spanish automatically when saving.",
    newQuestion: "New question",
    editQuestion: "Edit question",
    promptPt: "Question in Portuguese",
    helperPt: "Guidance in Portuguese",
    promptPlaceholder: "E.g.: What helped you most to find here?",
    helperPlaceholder: "A short guide for the person answering",
    required: "Required answer",
    active: "Question visible on site",
    position: "Order",
    save: "Save question",
    saving: "Saving…",
    translating: "Translating…",
    cancel: "Cancel edit",
    edit: "Edit",
    activate: "Activate",
    deactivate: "Deactivate",
    activeLabel: "Active",
    inactiveLabel: "Inactive",
    requiredLabel: "Required",
    optionalLabel: "Optional",
    automaticTranslation: "English and Spanish are updated automatically when this question is saved.",
    empty: "No questions have been added yet.",
    resultsTitle: "Site ratings",
    resultsIntro: "Aggregated view of final ratings. No written answer is shown in this panel.",
    total: "Ratings received",
    average: "Overall average",
    distribution: "Distribution by stars",
    stars: (value: number) => `${value} star${value === 1 ? "" : "s"}`,
    noResults: "Ratings will appear here after the first submission.",
    loadError: "The questionnaire could not be loaded right now.",
    saveError: "This question could not be saved right now.",
    translationError: "This question could not be translated right now. Try again before saving.",
    saved: "Question saved.",
    updated: "Question updated.",
    toggleError: "The question status could not be changed.",
    deleteQuestion: "Delete",
    deleteTitle: "Delete question",
    deleteDescription: "This question will be removed from administration and will no longer appear in the questionnaire. Existing ratings will not be changed.",
    deleteConfirm: "Delete question",
    deleteSuccess: "Question deleted.",
    deleteError: "This question could not be deleted right now.",
    requiredPrompt: "Write the Portuguese question before saving.",
    positionError: "Order must be an integer greater than or equal to zero.",
  },
  es: {
    title: "Cuestionario y valoraciones",
    intro: "Crea preguntas para el área pública y acompaña la valoración general del sitio sin abrir respuestas individuales.",
    editorTitle: "Preguntas públicas",
    editorIntro: "Escribe en portugués. El sitio prepara inglés y español automáticamente al guardar.",
    newQuestion: "Nueva pregunta",
    editQuestion: "Editar pregunta",
    promptPt: "Pregunta en portugués",
    helperPt: "Orientación en portugués",
    promptPlaceholder: "Ej.: ¿Qué fue lo que más te ayudó a encontrar aquí?",
    helperPlaceholder: "Una orientación breve para quien responde",
    required: "Respuesta obligatoria",
    active: "Pregunta visible en el sitio",
    position: "Orden",
    save: "Guardar pregunta",
    saving: "Guardando…",
    translating: "Traduciendo…",
    cancel: "Cancelar edición",
    edit: "Editar",
    activate: "Activar",
    deactivate: "Desactivar",
    activeLabel: "Activa",
    inactiveLabel: "Inactiva",
    requiredLabel: "Obligatoria",
    optionalLabel: "Opcional",
    automaticTranslation: "El inglés y el español se actualizan automáticamente al guardar esta pregunta.",
    empty: "Aún no hay preguntas registradas.",
    resultsTitle: "Valoraciones del sitio",
    resultsIntro: "Vista agregada de las notas finales. Ninguna respuesta escrita se muestra en este panel.",
    total: "Valoraciones recibidas",
    average: "Promedio general",
    distribution: "Distribución por estrellas",
    stars: (value: number) => `${value} estrella${value === 1 ? "" : "s"}`,
    noResults: "Las valoraciones aparecerán después del primer envío.",
    loadError: "No fue posible cargar el cuestionario ahora.",
    saveError: "No fue posible guardar esta pregunta ahora.",
    translationError: "No fue posible traducir esta pregunta ahora. Inténtalo de nuevo antes de guardar.",
    saved: "Pregunta guardada.",
    updated: "Pregunta actualizada.",
    toggleError: "No fue posible cambiar el estado de la pregunta.",
    deleteQuestion: "Eliminar",
    deleteTitle: "Eliminar pregunta",
    deleteDescription: "Esta pregunta se quitará de la administración y ya no aparecerá en el cuestionario. Las valoraciones existentes no cambiarán.",
    deleteConfirm: "Eliminar pregunta",
    deleteSuccess: "Pregunta eliminada.",
    deleteError: "No fue posible eliminar esta pregunta ahora.",
    requiredPrompt: "Escribe la pregunta en portugués antes de guardar.",
    positionError: "El orden debe ser un número entero mayor o igual que cero.",
  },
} as const;

const questionFields = "id,prompt_pt,prompt_en,prompt_es,helper_pt,helper_en,helper_es,is_required,is_active,position,created_at,updated_at";

function questionToForm(question: QuestionnaireQuestion): QuestionForm {
  return {
    prompt_pt: question.prompt_pt,
    helper_pt: question.helper_pt ?? "",
    is_required: question.is_required,
    is_active: question.is_active,
    position: String(question.position),
  };
}

export default function QuestionnaireAdmin({ canManage, canViewResults }: { canManage: boolean; canViewResults: boolean }) {
  const { user } = useAuth();
  const { language } = useSiteLanguage();
  const t = questionnaireAdminCopy[language];
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [results, setResults] = useState<QuestionnaireResults | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuestionnaireQuestion | null>(null);

  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)), [questions]);
  const distribution = results?.distribution ?? [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 }));

  async function loadQuestions() {
    if (!canManage) return;
    setLoadingQuestions(true);
    const { data, error } = await supabase.from("endoacolhe_questionnaire_questions").select(questionFields).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(50);
    if (error) toast.error(t.loadError);
    else setQuestions((data ?? []) as QuestionnaireQuestion[]);
    setLoadingQuestions(false);
  }

  async function loadResults() {
    if (!canViewResults) return;
    setLoadingResults(true);
    const { data, error } = await supabase.rpc("list_endoacolhe_questionnaire_results");
    if (error) toast.error(t.loadError);
    else setResults(data as QuestionnaireResults);
    setLoadingResults(false);
  }

  useEffect(() => {
    void loadQuestions();
    void loadResults();
    const channel = supabase
      .channel("endoacolhe-questionnaire-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "endoacolhe_questionnaire_questions" }, () => void loadQuestions())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "endoacolhe_questionnaire_responses" }, () => void loadResults())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // The current language changes labels only; database listeners do not need to restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canViewResults]);

  function startNewQuestion() {
    setEditingId(null);
    setForm({ ...emptyForm, position: String(questions.length) });
  }

  function startEdit(question: QuestionnaireQuestion) {
    setEditingId(question.id);
    setForm(questionToForm(question));
  }

  function updateForm(field: keyof QuestionForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createTranslations(promptPt: string, helperPt: string): Promise<QuestionnaireTranslations | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return null;
    const response = await fetch(`${apiBase}/api/admin-translate-questionnaire`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ promptPt, helperPt }),
    });
    if (!response.ok) return null;
    const translations = await response.json() as Partial<QuestionnaireTranslations>;
    return translations.promptEn && translations.promptEs
      ? { promptEn: translations.promptEn, promptEs: translations.promptEs, helperEn: translations.helperEn ?? "", helperEs: translations.helperEs ?? "" }
      : null;
  }

  async function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManage || saving || translating) return;
    const position = Number(form.position);
    const sourceQuestion = form.prompt_pt.trim();
    const sourceHelper = form.helper_pt.trim();
    if (!sourceQuestion) {
      toast.error(t.requiredPrompt);
      return;
    }
    if (!Number.isInteger(position) || position < 0) {
      toast.error(t.positionError);
      return;
    }
    setTranslating(true);
    let translations: QuestionnaireTranslations | null = null;
    try {
      translations = await createTranslations(sourceQuestion, sourceHelper);
    } catch {
      translations = null;
    }
    setTranslating(false);
    if (!translations) {
      toast.error(t.translationError);
      return;
    }
    const payload = {
      prompt_pt: sourceQuestion,
      prompt_en: translations.promptEn,
      prompt_es: translations.promptEs,
      helper_pt: sourceHelper || null,
      helper_en: translations.helperEn || null,
      helper_es: translations.helperEs || null,
      is_required: form.is_required,
      is_active: form.is_active,
      position,
      updated_by: user.id,
    };
    setSaving(true);
    const result = editingId
      ? await supabase.from("endoacolhe_questionnaire_questions").update(payload).eq("id", editingId)
      : await supabase.from("endoacolhe_questionnaire_questions").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (result.error) {
      toast.error(t.saveError);
      return;
    }
    toast.success(editingId ? t.updated : t.saved);
    setEditingId(null);
    setForm(emptyForm);
    await loadQuestions();
  }

  async function toggleQuestion(question: QuestionnaireQuestion) {
    if (!canManage || togglingId || deletingId) return;
    setTogglingId(question.id);
    const { error } = await supabase.from("endoacolhe_questionnaire_questions").update({ is_active: !question.is_active }).eq("id", question.id);
    setTogglingId(null);
    if (error) toast.error(t.toggleError);
    else await loadQuestions();
  }

  async function deleteQuestion() {
    if (!canManage || !deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    const { error } = await supabase.from("endoacolhe_questionnaire_questions").delete().eq("id", deleteTarget.id);
    setDeletingId(null);
    if (error) {
      toast.error(t.deleteError);
      return;
    }
    if (editingId === deleteTarget.id) {
      setEditingId(null);
      setForm(emptyForm);
    }
    setDeleteTarget(null);
    toast.success(t.deleteSuccess);
    await loadQuestions();
  }

  return <section id="admin-questionnaire" className="admin-panel admin-questionnaire-panel">
    <div className="admin-panel__heading"><span><ClipboardList size={18} />{t.title}</span><small>{questions.length}</small></div>
    <p className="admin-post-intro">{t.intro}</p>
    {canManage ? <div className="questionnaire-admin-editor">
      <div className="questionnaire-admin-subheading"><div><h3>{editingId ? t.editQuestion : t.editorTitle}</h3><p>{t.editorIntro}</p></div><button type="button" className="admin-refresh" onClick={startNewQuestion}><Plus size={15} />{t.newQuestion}</button></div>
      {loadingQuestions ? <div className="admin-empty"><LoaderCircle className="questionnaire-admin-spinner" size={22} /><p>{t.loadError}</p></div> : <form className="questionnaire-admin-form" onSubmit={saveQuestion}>
        <label className="questionnaire-admin-field questionnaire-admin-field--wide">{t.promptPt}<textarea value={form.prompt_pt} onChange={(event) => updateForm("prompt_pt", event.target.value)} placeholder={t.promptPlaceholder} maxLength={300} rows={2} required /></label>
        <label className="questionnaire-admin-field">{t.helperPt}<input value={form.helper_pt} onChange={(event) => updateForm("helper_pt", event.target.value)} placeholder={t.helperPlaceholder} maxLength={320} /></label>
        <label className="questionnaire-admin-order">{t.position}<input type="number" min="0" step="1" value={form.position} onChange={(event) => updateForm("position", event.target.value)} /></label>
        <label className="questionnaire-admin-check"><input type="checkbox" checked={form.is_required} onChange={(event) => updateForm("is_required", event.target.checked)} /><span>{t.required}</span></label>
        <label className="questionnaire-admin-check"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} /><span>{t.active}</span></label>
        <div className="questionnaire-admin-form-actions"><button type="submit" className="admin-approve" disabled={saving || translating}>{saving || translating ? <LoaderCircle className="questionnaire-admin-spinner" size={15} /> : <Save size={15} />}{saving ? t.saving : translating ? t.translating : t.save}</button>{editingId ? <button type="button" className="admin-refresh" onClick={() => { setEditingId(null); setForm(emptyForm); }}><X size={15} />{t.cancel}</button> : null}</div>
      </form>}
      <div className="questionnaire-admin-list">{sortedQuestions.length ? sortedQuestions.map((question) => <article className={question.is_active ? "questionnaire-admin-item" : "questionnaire-admin-item is-inactive"} key={question.id}><div className="questionnaire-admin-item-copy"><div className="questionnaire-admin-item-meta"><span>#{String(question.position + 1).padStart(2, "0")}</span><em>{question.is_active ? t.activeLabel : t.inactiveLabel}</em><em>{question.is_required ? t.requiredLabel : t.optionalLabel}</em></div><strong>{question.prompt_pt}</strong><small>{t.automaticTranslation}</small></div><div className="questionnaire-admin-item-actions"><button type="button" className="admin-edit-content" onClick={() => startEdit(question)}><Pencil size={15} />{t.edit}</button><button type="button" className={question.is_active ? "admin-reject" : "admin-approve"} onClick={() => void toggleQuestion(question)} disabled={togglingId === question.id || deletingId === question.id}>{togglingId === question.id ? <LoaderCircle className="questionnaire-admin-spinner" size={15} /> : question.is_active ? <EyeOff size={15} /> : <Eye size={15} />}{question.is_active ? t.deactivate : t.activate}</button><button type="button" className="admin-delete-content" onClick={() => setDeleteTarget(question)} disabled={Boolean(togglingId) || deletingId === question.id}><Trash2 size={15} />{deletingId === question.id ? t.saving : t.deleteQuestion}</button></div></article>) : <div className="admin-empty"><ClipboardList size={25} /><p>{t.empty}</p></div>}</div>
    </div> : null}
    {canViewResults ? <div className="questionnaire-admin-results">
      <div className="questionnaire-admin-subheading"><div><h3>{t.resultsTitle}</h3><p>{t.resultsIntro}</p></div><span className="questionnaire-admin-privacy"><ShieldCheckIcon />{t.resultsIntro}</span></div>
      {loadingResults ? <div className="admin-empty"><LoaderCircle className="questionnaire-admin-spinner" size={22} /><p>{t.noResults}</p></div> : results ? <><div className="questionnaire-results-summary"><article><span>{t.total}</span><strong>{results.total_responses}</strong></article><article><span>{t.average}</span><strong>{results.average_rating.toFixed(2)} <small>/ 5</small></strong></article></div><div className="questionnaire-results-chart"><h4>{t.distribution}</h4>{results.total_responses ? <ResponsiveContainer width="100%" height={240}><BarChart data={distribution} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(99, 69, 86, .14)" /><XAxis dataKey="rating" tickFormatter={(value) => `${value}★`} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [value, language === "en" ? "ratings" : language === "es" ? "valoraciones" : "avaliações"]} labelFormatter={(value) => t.stars(Number(value))} /><Bar dataKey="count" name={language === "en" ? "Ratings" : language === "es" ? "Valoraciones" : "Avaliações"} fill="#7e486f" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="questionnaire-results-empty"><Star size={22} /><p>{t.noResults}</p></div>}</div></> : <div className="admin-empty"><Star size={25} /><p>{t.noResults}</p></div>}
    </div> : null}
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription></AlertDialogHeader><div className="questionnaire-admin-delete-copy"><strong>{deleteTarget?.prompt_pt}</strong></div><AlertDialogFooter><AlertDialogCancel disabled={Boolean(deletingId)}>{t.cancel}</AlertDialogCancel><AlertDialogAction className="admin-dialog-suspend" disabled={Boolean(deletingId)} onClick={(event) => { event.preventDefault(); void deleteQuestion(); }}>{deletingId ? <LoaderCircle className="questionnaire-admin-spinner" size={15} /> : <Trash2 size={15} />}{deletingId ? t.saving : t.deleteConfirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

function ShieldCheckIcon() {
  return <Check size={15} aria-hidden="true" />;
}
