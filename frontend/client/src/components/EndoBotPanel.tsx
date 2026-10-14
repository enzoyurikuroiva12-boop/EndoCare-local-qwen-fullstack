import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, FolderOpen, Globe2, LockKeyhole, MessageCirclePlus, Mic, Send, ShieldAlert, Sparkles, Square, Trash2, Volume2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { botLanguages, initialBotMessage, type BotLanguage } from "@/lib/endoBotLanguage";
import { isNearChatBottom } from "@/lib/chatScroll";
import { handleMessageComposerKeyDown } from "@/lib/messageComposer";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { useAccountControl } from "@/contexts/AccountControlContext";
import { blocksRestrictedFeatures } from "@/lib/accountControl";
import { EndoBotApiError, requestEndoBot } from "@/lib/endoBotApi";
import { createEndoBotRequestHeaders, getInitialEndoBotHistoryMode, submitEndoBotQuestion, throwIfEndoBotCancelled } from "@/lib/endoBotConversation";
import "./EndoBotPanel.css";

type ChatMessage = { id?: string; role: "user" | "assistant" | "human"; content: string };
type Conversation = { id: string; category: string; language: BotLanguage; title: string; updated_at: string; human_review_consent: boolean; human_takeover_status: "automated" | "paused" };

const categories = ["Informações gerais", "Sintomas", "Perguntas para consulta", "Organização pessoal"] as const;
type Category = typeof categories[number];
const apiBase = import.meta.env.VITE_API_BASE_URL || "https://backendendoacolhe.vercel.app";

export function createTemporaryMessages(language: BotLanguage): ChatMessage[] {
  return [initialBotMessage(language)];
}

export const endoBotCopy = {
  pt: {
    loadHistoryError: "Não foi possível carregar o histórico agora.",
    startHistoryError: "Não foi possível iniciar o histórico.",
    openHistoryError: "Não foi possível abrir esta conversa agora.",
    messageLimit: "Escreva uma mensagem de até 700 caracteres.",
    redacted: "Dados pessoais identificáveis foram removidos antes do processamento da mensagem.",
    unavailable: "Não consegui responder agora. Tente novamente em alguns instantes.",
    placeholder: "Ex.: Como posso organizar minhas perguntas para a consulta?",
    transientNote: "Esta conversa temporária desaparece ao recarregar a página.",
    eyebrow: "EndoBot",
    title: <>Informação geral, com <em>cuidado</em>.</>,
    intro: "Use este espaço para esclarecer dúvidas gerais e preparar perguntas para sua conversa com um profissional. O EndoBot não substitui atendimento médico.",
    privacy: "Não informe dados pessoais",
    noDiagnosis: "Sem diagnóstico ou prescrição",
    privateNote: "Suas conversas salvas ficam privadas na sua conta e podem ser separadas por categoria.",
    chatLabel: "Chat do EndoBot",
    privateHistory: "histórico privado",
    temporarySession: "sessão temporária",
    available: "disponível",
    checking: "verificando disponibilidade",
    unavailableStatus: "Indisponível",
    serviceUnavailable: "O EndoBot está indisponível no momento. O envio de mensagens foi desabilitado.",
    restricted: "Sua conta está Restrita. Por favor, contate um administrador para saber o motivo.",
    conversations: "Suas conversas",
    newChat: "Nova com histórico",
    filterCategories: "Filtrar conversas por categoria",
    allCategories: "Todas as categorias",
    emptyConversations: "Suas conversas salvas aparecerão aqui.",
    languageLabel: "Idioma do EndoBot",
    categoryLabel: "Categoria",
    user: "Você",
    question: "Sua pergunta",
    privacyReminder: "Evite nomes, telefones, e-mails ou outros dados pessoais.",
    answering: "Respondendo…",
    send: "Enviar",
    voiceStart: "Falar com o EndoBot",
    voiceStop: "Parar gravação",
    voiceProcessing: "Ouvindo e preparando resposta…",
    voicePlaying: "Reproduzindo resposta",
    voiceUnavailable: "O modo de voz está indisponível. Use o chat textual.",
    voiceDisclosure: "A resposta de voz é gerada por IA e o áudio não é armazenado permanentemente.",
    voiceLocal: "Voz feminina acolhedora. Áudio gerado neste computador e não armazenado permanentemente.",
    hearReply: "Ouvir resposta",
    stopAudio: "Parar áudio",
    preparingAudio: "Preparando voz…",
    audioReady: "Áudio preparado. Clique em Ouvir resposta para reproduzir.",
    readRepliesOn: "Leitura automática: ligada",
    readRepliesOff: "Leitura automática: desligada",
    retryAvailability: "Tentar reconectar",
    slowResponse: "O modelo demorou mais que o esperado. Você pode tentar enviar novamente.",
    historyFailed: "Não foi possível salvar o histórico. Tente novamente ou inicie uma conversa temporária.",
    temporaryChat: "Nova temporária",
    recoverTemporaryChat: "Continuar em nova conversa temporária",
    sessionExpired: "Sua sessão expirou. Entre novamente na conta para continuar.",
    jumpToLatest: "Ir para a mensagem mais recente",
    enterHint: "Enter envia · Shift + Enter quebra a linha",
    suggestionsLabel: "Perguntas para começar",
    deleteConversation: "Excluir conversa",
    deleteConversationConfirm: "Excluir esta conversa salva? Esta ação não pode ser desfeita.",
    deleteConversationError: "Não foi possível excluir esta conversa agora.",
    humanConsentTitle: "Transparência do acompanhamento humano",
    humanConsentDescription: "Para oferecer suporte e segurança, conversas autenticadas do EndoBot podem ser visualizadas pelo Dono do EndoCare quando necessário. O acompanhamento é limitado a esta conversa e não inclui monitoramento geral da sua conta.",
    humanConsentLabel: "Esta conversa está sujeita a acompanhamento humano para suporte.",
    humanConsentActive: "O acompanhamento humano está autorizado nesta conversa.",
    withdrawHumanConsent: "Retirar autorização",
    humanConsentError: "Não foi possível atualizar sua autorização agora.",
    humanTeamTakenOver: "A equipe humana do EndoCare assumiu esta conversa. O EndoBot não responderá automaticamente enquanto ela estiver pausada.",
    messageSentToHumanTeam: "Sua mensagem foi enviada para a equipe humana do EndoCare.",
    humanTeam: "Equipe humana do EndoCare",
    suggestions: ["Quais perguntas posso levar para a consulta?", "Como posso usar meu diário de sintomas na consulta?", "Quais sinais devo registrar ao longo do ciclo?"],
    categories: { "Informações gerais": "Informações gerais", "Sintomas": "Sintomas", "Perguntas para consulta": "Perguntas para consulta", "Organização pessoal": "Organização pessoal" },
  },
  en: {
    loadHistoryError: "Conversation history cannot be loaded right now.",
    startHistoryError: "Conversation history could not be started.",
    openHistoryError: "This conversation cannot be opened right now.",
    messageLimit: "Write a message of up to 700 characters.",
    redacted: "Identifiable personal data was removed before your message was processed.",
    unavailable: "I could not respond right now. Please try again in a few moments.",
    placeholder: "E.g.: How can I organize questions for my appointment?",
    transientNote: "This temporary conversation disappears when the page is refreshed.",
    eyebrow: "EndoBot",
    title: <>General information, with <em>care</em>.</>,
    intro: "Use this space to clarify general questions and prepare questions for a conversation with a professional. EndoBot does not replace medical care.",
    privacy: "Do not share personal data",
    noDiagnosis: "No diagnosis or prescription",
    privateNote: "Your saved conversations remain private in your account and can be organized by category.",
    chatLabel: "EndoBot chat",
    privateHistory: "private history",
    temporarySession: "temporary session",
    available: "available",
    checking: "checking availability",
    unavailableStatus: "Unavailable",
    serviceUnavailable: "EndoBot is currently unavailable. Sending messages has been disabled.",
    restricted: "Your account is restricted. Please contact an administrator to learn why.",
    conversations: "Your conversations",
    newChat: "New saved chat",
    filterCategories: "Filter conversations by category",
    allCategories: "All categories",
    emptyConversations: "Your saved conversations will appear here.",
    languageLabel: "EndoBot language",
    categoryLabel: "Category",
    user: "You",
    question: "Your question",
    privacyReminder: "Avoid names, phone numbers, emails, or other personal data.",
    answering: "Answering…",
    send: "Send",
    voiceStart: "Talk to EndoBot",
    voiceStop: "Stop recording",
    voiceProcessing: "Listening and preparing a reply…",
    voicePlaying: "Playing reply",
    voiceUnavailable: "Voice mode is unavailable. Use text chat.",
    voiceDisclosure: "The spoken reply is AI-generated and audio is not stored permanently.",
    voiceLocal: "A warm female voice. Audio is generated on this computer and is not stored permanently.",
    hearReply: "Listen to reply",
    stopAudio: "Stop audio",
    preparingAudio: "Preparing voice…",
    audioReady: "Audio is ready. Click Listen to reply to play it.",
    readRepliesOn: "Automatic reading: on",
    readRepliesOff: "Automatic reading: off",
    retryAvailability: "Try reconnecting",
    slowResponse: "The model took longer than expected. You can try sending again.",
    historyFailed: "Your history could not be saved. Try again or start a temporary conversation.",
    temporaryChat: "New temporary chat",
    recoverTemporaryChat: "Continue in a new temporary chat",
    sessionExpired: "Your session expired. Sign in again to continue.",
    jumpToLatest: "Go to the latest message",
    enterHint: "Enter sends · Shift + Enter adds a new line",
    suggestionsLabel: "Questions to begin",
    deleteConversation: "Delete conversation",
    deleteConversationConfirm: "Delete this saved conversation? This cannot be undone.",
    deleteConversationError: "This conversation cannot be deleted right now.",
    humanConsentTitle: "Human review transparency",
    humanConsentDescription: "For support and safety, authenticated EndoBot conversations may be viewed by the EndoCare Owner when needed. Review is limited to this conversation and is not general monitoring of your account.",
    humanConsentLabel: "This conversation may receive human review for support.",
    humanConsentActive: "Human review is allowed for this conversation.",
    withdrawHumanConsent: "Withdraw permission",
    humanConsentError: "Your permission could not be updated right now.",
    humanTeamTakenOver: "The EndoCare human team has taken over this conversation. EndoBot will not reply automatically while it is paused.",
    messageSentToHumanTeam: "Your message has been sent to the EndoCare human team.",
    humanTeam: "EndoCare human team",
    suggestions: ["What questions can I bring to my appointment?", "How can I use my symptom diary in an appointment?", "What signs should I track throughout my cycle?"],
    categories: { "Informações gerais": "General information", "Sintomas": "Symptoms", "Perguntas para consulta": "Appointment questions", "Organização pessoal": "Personal organization" },
  },
  es: {
    loadHistoryError: "No es posible cargar el historial ahora.",
    startHistoryError: "No fue posible iniciar el historial.",
    openHistoryError: "No es posible abrir esta conversación ahora.",
    messageLimit: "Escribe un mensaje de hasta 700 caracteres.",
    redacted: "Los datos personales identificables se eliminaron antes de procesar tu mensaje.",
    unavailable: "No pude responder ahora. Inténtalo de nuevo en unos instantes.",
    placeholder: "Ej.: ¿Cómo organizo preguntas para mi consulta?",
    transientNote: "Esta conversación temporal desaparece al recargar la página.",
    eyebrow: "EndoBot",
    title: <>Información general, con <em>cuidado</em>.</>,
    intro: "Usa este espacio para aclarar dudas generales y preparar preguntas para conversar con un profesional. EndoBot no sustituye la atención médica.",
    privacy: "No compartas datos personales",
    noDiagnosis: "Sin diagnóstico ni prescripción",
    privateNote: "Tus conversaciones guardadas permanecen privadas en tu cuenta y pueden organizarse por categoría.",
    chatLabel: "Chat de EndoBot",
    privateHistory: "historial privado",
    temporarySession: "sesión temporal",
    available: "disponible",
    checking: "comprobando disponibilidad",
    unavailableStatus: "No disponible",
    serviceUnavailable: "EndoBot no está disponible en este momento. El envío de mensajes fue deshabilitado.",
    restricted: "Tu cuenta está restringida. Contacta a una persona administradora para saber el motivo.",
    conversations: "Tus conversaciones",
    newChat: "Nueva con historial",
    filterCategories: "Filtrar conversaciones por categoría",
    allCategories: "Todas las categorías",
    emptyConversations: "Tus conversaciones guardadas aparecerán aquí.",
    languageLabel: "Idioma de EndoBot",
    categoryLabel: "Categoría",
    user: "Tú",
    question: "Tu pregunta",
    privacyReminder: "Evita nombres, teléfonos, correos u otros datos personales.",
    answering: "Respondiendo…",
    send: "Enviar",
    voiceStart: "Hablar con EndoBot",
    voiceStop: "Detener grabación",
    voiceProcessing: "Escuchando y preparando la respuesta…",
    voicePlaying: "Reproduciendo respuesta",
    voiceUnavailable: "El modo de voz no está disponible. Usa el chat de texto.",
    voiceDisclosure: "La respuesta de voz es generada por IA y el audio no se almacena permanentemente.",
    voiceLocal: "Voz femenina cálida. El audio se genera en este equipo y no se almacena permanentemente.",
    hearReply: "Escuchar respuesta",
    stopAudio: "Detener audio",
    preparingAudio: "Preparando voz…",
    audioReady: "Audio preparado. Pulsa Escuchar respuesta para reproducirlo.",
    readRepliesOn: "Lectura automática: activada",
    readRepliesOff: "Lectura automática: desactivada",
    retryAvailability: "Intentar reconectar",
    slowResponse: "El modelo tardó más de lo esperado. Puedes intentar enviar de nuevo.",
    historyFailed: "No fue posible guardar el historial. Inténtalo de nuevo o inicia una conversación temporal.",
    temporaryChat: "Nueva temporal",
    recoverTemporaryChat: "Continuar en una nueva conversación temporal",
    sessionExpired: "Tu sesión ha caducado. Inicia sesión de nuevo para continuar.",
    jumpToLatest: "Ir a la última mensaje",
    enterHint: "Enter envía · Shift + Enter agrega una línea",
    suggestionsLabel: "Preguntas para comenzar",
    deleteConversation: "Eliminar conversación",
    deleteConversationConfirm: "¿Eliminar esta conversación guardada? Esta acción no se puede deshacer.",
    deleteConversationError: "No fue posible eliminar esta conversación ahora.",
    humanConsentTitle: "Transparencia del acompañamiento humano",
    humanConsentDescription: "Para ofrecer soporte y seguridad, las conversaciones autenticadas de EndoBot pueden ser vistas por el Dueño de EndoCare cuando sea necesario. La revisión se limita a esta conversación y no es una supervisión general de tu cuenta.",
    humanConsentLabel: "Esta conversación puede recibir acompañamiento humano para soporte.",
    humanConsentActive: "El acompañamiento humano está autorizado en esta conversación.",
    withdrawHumanConsent: "Retirar autorización",
    humanConsentError: "No fue posible actualizar tu autorización ahora.",
    humanTeamTakenOver: "El equipo humano de EndoCare asumió esta conversación. EndoBot no responderá automáticamente mientras esté pausada.",
    messageSentToHumanTeam: "Tu mensaje se envió al equipo humano de EndoCare.",
    humanTeam: "Equipo humano de EndoCare",
    suggestions: ["¿Qué preguntas puedo llevar a la consulta?", "¿Cómo puedo usar mi diario de síntomas en la consulta?", "¿Qué señales debo registrar durante el ciclo?"],
    categories: { "Informações gerais": "Información general", "Sintomas": "Síntomas", "Perguntas para consulta": "Preguntas para la consulta", "Organização pessoal": "Organización personal" },
  },
} as const;

export function EndoBotPanel() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { language: globalLanguage, setLanguage: setGlobalLanguage } = useSiteLanguage();
  const { control } = useAccountControl();
  const [language, setLanguage] = useState<BotLanguage>(globalLanguage);
  const [messages, setMessages] = useState<ChatMessage[]>(() => createTemporaryMessages(globalLanguage));
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [historyMode, setHistoryMode] = useState<"saved" | "temporary">(() => getInitialEndoBotHistoryMode(apiBase));
  const [failedQuestion, setFailedQuestion] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [pending, setPending] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>(categories[0]);
  const [archiveFilter, setArchiveFilter] = useState<"all" | Category>("all");
  const [humanReviewConsent, setHumanReviewConsent] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<"checking" | "available" | "unavailable">("checking");
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing" | "playing">("idle");
  const [readReplies, setReadReplies] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState<string | null>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const followLatestRef = useRef(true);
  const availabilityCheckRef = useRef<(() => Promise<void>) | null>(null);
  const voiceRequestRef = useRef<AbortController | null>(null);
  const voiceFlowRequestRef = useRef<AbortController | null>(null);
  const textRequestRef = useRef<AbortController | null>(null);
  const recordingSessionRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const voiceAudioCacheRef = useRef<{ text: string; language: BotLanguage; audioBase64: string; audioMimeType: string } | null>(null);
  const t = endoBotCopy[language];
  const categoryLabel = (value: string) => t.categories[value as Category] ?? value;
  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === activeConversationId) ?? null, [activeConversationId, conversations]);
  const humanTakeoverPaused = activeConversation?.human_takeover_status === "paused";
  const savedHistory = isAuthenticated && historyMode === "saved";

  useEffect(() => () => {
    recordingSessionRef.current += 1;
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    audioRef.current?.pause();
    voiceRequestRef.current?.abort();
    voiceFlowRequestRef.current?.abort();
    textRequestRef.current?.abort();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setActiveConversationId(null);
      setArchiveError("");
      return;
    }
    let active = true;
    setArchiveError("");
    void supabase.from("endobot_conversations").select("id, category, language, title, updated_at, human_review_consent, human_takeover_status").order("updated_at", { ascending: false }).limit(40).abortSignal(AbortSignal.timeout(10_000)).then(({ data, error }) => {
      if (!active) return;
      if (error) setArchiveError(endoBotCopy[globalLanguage].loadHistoryError);
      else setConversations((data ?? []) as Conversation[]);
    });
    return () => { active = false; };
  }, [globalLanguage, user?.id]);

  useEffect(() => {
    if (!activeConversationId || !isAuthenticated) return;
    const channel = supabase
      .channel(`endobot-conversation-${activeConversationId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "endobot_conversations", filter: `id=eq.${activeConversationId}` }, (payload) => {
        const updated = payload.new as Conversation;
        setConversations((current) => current.map((conversation) => conversation.id === updated.id ? { ...conversation, ...updated } : conversation));
        if (updated.human_takeover_status === "paused") setNotice(endoBotCopy[language].humanTeamTakenOver);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "endobot_messages", filter: `conversation_id=eq.${activeConversationId}` }, (payload) => {
        const message = payload.new as ChatMessage;
        if (message.role !== "human") return;
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        setNotice("");
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeConversationId, isAuthenticated, language]);

  useEffect(() => {
    if (language === globalLanguage) return;
    cancelVoiceRecording();
    cancelVoiceFlow();
    cancelTextFlow();
    stopVoicePlayback();
    setLanguage(globalLanguage);
    if (!activeConversationId || !isAuthenticated) {
      setMessages(createTemporaryMessages(globalLanguage));
      setDraft("");
      setNotice("");
    }
  }, [activeConversationId, globalLanguage, isAuthenticated, language]);

  useEffect(() => {
    let active = true;
    const checkAvailability = async () => {
      if (!navigator.onLine) { if (active) setServiceStatus("unavailable"); return; }
      if (active) setServiceStatus("checking");
      try {
        const response = await fetch(`${apiBase}/api/health`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(8000) });
        const result = await response.json().catch(() => null) as { status?: string } | null;
        if (active) setServiceStatus(response.ok && result?.status === "ok" ? "available" : "unavailable");
      } catch { if (active) setServiceStatus("unavailable"); }
    };
    availabilityCheckRef.current = checkAvailability;
    void checkAvailability();
    const refresh = window.setInterval(() => void checkAvailability(), 15_000);
    const offline = () => setServiceStatus("unavailable");
    const online = () => void checkAvailability();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    return () => { active = false; availabilityCheckRef.current = null; window.clearInterval(refresh); window.removeEventListener("offline", offline); window.removeEventListener("online", online); window.removeEventListener("focus", online); };
  }, []);

  const visibleConversations = useMemo(() => archiveFilter === "all" ? conversations : conversations.filter((item) => item.category === archiveFilter), [archiveFilter, conversations]);

  function scrollToLatest() {
    const history = chatHistoryRef.current;
    if (!history) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    history.scrollTo({ top: history.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    followLatestRef.current = true;
    setHasNewMessages(false);
  }

  function handleHistoryScroll() {
    const history = chatHistoryRef.current;
    if (!history) return;
    followLatestRef.current = isNearChatBottom(history);
    if (followLatestRef.current) setHasNewMessages(false);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (followLatestRef.current) scrollToLatest();
      else setHasNewMessages(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function startNewChat(nextLanguage = language, nextHistoryMode: "saved" | "temporary" = "saved") {
    cancelVoiceRecording();
    cancelVoiceFlow();
    cancelTextFlow();
    stopVoicePlayback();
    voiceAudioCacheRef.current = null;
    followLatestRef.current = true;
    setHasNewMessages(false);
    setActiveConversationId(null);
    setMessages(createTemporaryMessages(nextLanguage));
    setDraft("");
    setNotice("");
    setHistoryMode(nextHistoryMode);
    setFailedQuestion("");
    setHumanReviewConsent(true);
  }

  function startTemporaryChat(question = "") {
    startNewChat(language, "temporary");
    setDraft(question);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function changeLanguage(nextLanguage: BotLanguage) {
    cancelVoiceRecording();
    cancelVoiceFlow();
    cancelTextFlow();
    stopVoicePlayback();
    setLanguage(nextLanguage);
    setGlobalLanguage(nextLanguage);
    if (!activeConversationId || !isAuthenticated) startNewChat(nextLanguage, historyMode);
  }

  async function persistMessage(conversationId: string, message: ChatMessage, signal?: AbortSignal) {
    throwIfEndoBotCancelled(signal);
    let query = supabase.from("endobot_messages").insert({ conversation_id: conversationId, role: message.role, content: message.content }).select("id");
    query = query.abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000));
    const { data, error } = await query.single();
    throwIfEndoBotCancelled(signal);
    if (error) throw error;
    return data?.id as string | undefined;
  }

  async function ensureConversation(question: string, signal?: AbortSignal) {
    throwIfEndoBotCancelled(signal);
    if (!user) return null;
    if (activeConversationId) return activeConversationId;
    let query = supabase.from("endobot_conversations").insert({ owner_id: user.id, category, language, title: question.slice(0, 120), human_review_consent: humanReviewConsent, human_review_consent_at: humanReviewConsent ? new Date().toISOString() : null, human_review_consent_version: humanReviewConsent ? "2026-08-27" : null }).select("id, category, language, title, updated_at, human_review_consent, human_takeover_status");
    query = query.abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000));
    const { data, error } = await query.single();
    throwIfEndoBotCancelled(signal);
    if (error || !data) throw error ?? new Error(t.startHistoryError);
    const conversation = data as Conversation;
    setActiveConversationId(conversation.id);
    setConversations((current) => [conversation, ...current]);
    return conversation.id;
  }

  async function loadConversation(conversation: Conversation) {
    cancelVoiceRecording();
    cancelVoiceFlow();
    cancelTextFlow();
    stopVoicePlayback();
    setPending(true);
    const { data, error } = await supabase.from("endobot_messages").select("role, content").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(80).abortSignal(AbortSignal.timeout(10_000));
    setPending(false);
    if (error) return setNotice(t.openHistoryError);
    cancelVoiceRecording();
    stopVoicePlayback();
    voiceAudioCacheRef.current = null;
    setActiveConversationId(conversation.id);
    setHistoryMode("saved");
    setFailedQuestion("");
    setCategory(categories.includes(conversation.category as Category) ? conversation.category as Category : categories[0]);
    setLanguage(conversation.language);
    setGlobalLanguage(conversation.language);
    setHumanReviewConsent(conversation.human_review_consent);
    followLatestRef.current = true;
    setHasNewMessages(false);
    setMessages((data ?? []) as ChatMessage[]);
    setNotice("");
  }

  async function deleteConversation(conversation: Conversation) {
    if (!window.confirm(t.deleteConversationConfirm)) return;
    const { error } = await supabase.from("endobot_conversations").delete().eq("id", conversation.id);
    if (error) return setNotice(t.deleteConversationError);
    setConversations((current) => current.filter((item) => item.id !== conversation.id));
    if (activeConversationId === conversation.id) startNewChat();
  }

  function useSuggestedQuestion(question: string) {
    setDraft(question);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function updateHumanReviewConsent(nextConsent: boolean) {
    if (!activeConversationId) return;
    const { error } = await supabase.rpc("set_endoacolhe_endobot_human_review_consent", { p_conversation_id: activeConversationId, p_consent: nextConsent });
    if (error) { setNotice(t.humanConsentError); return; }
    setHumanReviewConsent(nextConsent);
    setConversations((current) => current.map((conversation) => conversation.id === activeConversationId ? { ...conversation, human_review_consent: nextConsent, human_takeover_status: nextConsent ? conversation.human_takeover_status : "automated" } : conversation));
    if (!nextConsent) setNotice("");
  }

  async function answerQuestion(userMessage: ChatMessage, context: { role: ChatMessage["role"]; content: string }[], signal?: AbortSignal) {
    const result = await submitEndoBotQuestion({
      question: userMessage.content,
      authenticated: isAuthenticated,
      historyMode,
      humanTakeoverPaused,
      signal,
      ensureConversation: async (question) => {
        try { return await ensureConversation(question, signal); }
        catch {
          throwIfEndoBotCancelled(signal);
          setFailedQuestion(userMessage.content);
          throw new EndoBotApiError(t.historyFailed, 0, "history_failed");
        }
      },
      persistQuestion: async (conversationId) => {
        let persistedId: string | undefined;
        try { persistedId = await persistMessage(conversationId, userMessage, signal); }
        catch {
          throwIfEndoBotCancelled(signal);
          setFailedQuestion(userMessage.content);
          throw new EndoBotApiError(t.historyFailed, 0, "history_failed");
        }
        throwIfEndoBotCancelled(signal);
        if (persistedId) setMessages((current) => current.map((message) => message.id === userMessage.id ? { ...message, id: persistedId } : message));
      },
      requestAnswer: async (conversationId) => {
        const sessionResult = await supabase.auth.getSession();
        throwIfEndoBotCancelled(signal);
        const headers = createEndoBotRequestHeaders({ authenticated: isAuthenticated, accessToken: sessionResult.data.session?.access_token, sessionError: sessionResult.error, sessionExpiredMessage: t.sessionExpired });
        const reply = await requestEndoBot<{ answer?: string; redacted?: boolean }>(`${apiBase}/api/endobot`, { method: "POST", headers, body: JSON.stringify({ question: userMessage.content, history: context, preferredLanguage: language, conversationId }), signal });
        if (!reply.answer) throw new EndoBotApiError(t.unavailable, 0, "invalid_response");
        return reply;
      },
    });
    throwIfEndoBotCancelled(signal);
    if (result.kind === "human") { setNotice(t.messageSentToHumanTeam); return null; }
    setServiceStatus("available");
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: result.result.answer! };
    setMessages((current) => [...current, assistantMessage]);
    if (result.result.redacted) setNotice(t.redacted);
    return assistantMessage;
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (authLoading) return;
    if (isAuthenticated && blocksRestrictedFeatures(control)) { setNotice(t.restricted); return; }
    if (serviceStatus === "unavailable" && !humanTakeoverPaused) { setNotice(t.serviceUnavailable); return; }
    if (!question || pending) return;
    if (question.length > 700) return setNotice(t.messageLimit);
    cancelVoiceRecording();
    stopVoicePlayback();
    const context = messages.slice(-4).map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setNotice("");
    setFailedQuestion("");
    setPending(true);
    const controller = new AbortController();
    textRequestRef.current = controller;
    try {
      const assistantMessage = await answerQuestion(userMessage, context, controller.signal);
      if (readReplies && assistantMessage) void speakReply(assistantMessage.content, assistantMessage.id!);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof EndoBotApiError && error.code === "human_supervision_paused") { setNotice(t.humanTeamTakenOver); return; }
      const message = error instanceof EndoBotApiError ? (error.code === "request_timeout" ? t.slowResponse : error.message) : t.unavailable;
      setNotice(message);
      // A failed request (including a rate limit or history error) does not mean the service is down.
      if (error instanceof EndoBotApiError && error.code === "network_error") void availabilityCheckRef.current?.();
    } finally {
      if (textRequestRef.current === controller) { textRequestRef.current = null; setPending(false); }
    }
  }

  function cancelTextFlow() {
    textRequestRef.current?.abort();
    textRequestRef.current = null;
    setPending(false);
  }

  function cancelVoiceFlow() {
    const controller = voiceFlowRequestRef.current;
    if (!controller) return;
    controller.abort();
    voiceFlowRequestRef.current = null;
    setPending(false);
    setVoiceState("idle");
  }

  function stopVoicePlayback() {
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setVoiceState("idle");
    setSpeakingMessage(null);
  }

  function cancelVoiceRecording() {
    recordingSessionRef.current += 1;
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    recorderRef.current = null;
    recordedChunksRef.current = [];
    setVoiceState("idle");
  }

  async function playVoiceAudio(audioBase64: string, audioMimeType: string) {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const audioUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0))], { type: audioMimeType }));
    audioUrlRef.current = audioUrl;
    const player = new Audio(audioUrl);
    audioRef.current = player;
    player.onended = () => { if (audioRef.current === player) stopVoicePlayback(); };
    player.onerror = () => { if (audioRef.current === player) { stopVoicePlayback(); setNotice(t.voiceUnavailable); } };
    setVoiceState("playing");
    await player.play();
  }

  async function speakReply(text: string, key: string) {
    cancelVoiceRecording();
    cancelVoiceFlow();
    stopVoicePlayback();
    setSpeakingMessage(key);
    setVoiceState("processing");
    const controller = new AbortController();
    voiceRequestRef.current = controller;
    try {
      const cached = voiceAudioCacheRef.current;
      let result: { audioBase64: string; audioMimeType: string };
      if (cached?.text === text && cached.language === language) result = cached;
      else {
        const sessionResult = await supabase.auth.getSession();
        throwIfEndoBotCancelled(controller.signal);
        const headers = createEndoBotRequestHeaders({ authenticated: isAuthenticated, accessToken: sessionResult.data.session?.access_token, sessionError: sessionResult.error, sessionExpiredMessage: t.sessionExpired });
        result = await requestEndoBot<{ audioBase64: string; audioMimeType: string }>(`${apiBase}/api/endobot-tts`, { method: "POST", headers, body: JSON.stringify({ text, preferredLanguage: language }), signal: controller.signal }, 180_000);
        throwIfEndoBotCancelled(controller.signal);
        if (!result.audioBase64) throw new EndoBotApiError(t.voiceUnavailable);
        voiceAudioCacheRef.current = { text, language, ...result };
      }
      if (controller.signal.aborted) return;
      await playVoiceAudio(result.audioBase64, result.audioMimeType || "audio/wav");
    } catch (error) {
      if (controller.signal.aborted) return;
      stopVoicePlayback();
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? t.audioReady : error instanceof EndoBotApiError ? error.message : t.voiceUnavailable);
    }
  }

  async function startVoiceRecording() {
    if (voiceState === "playing" || voiceState === "processing") { cancelVoiceFlow(); return stopVoicePlayback(); }
    if (authLoading || voiceState !== "idle" || pending || (serviceStatus === "unavailable" && !humanTakeoverPaused)) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setNotice(t.voiceUnavailable);
    if (isAuthenticated && blocksRestrictedFeatures(control)) return setNotice(t.restricted);
    const recordingSession = ++recordingSessionRef.current;
    let stream: MediaStream | undefined;
    setVoiceState("recording");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingSessionRef.current !== recordingSession) { stream.getTracks().forEach((track) => track.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((item) => MediaRecorder.isTypeSupported(item)) ?? "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (recordingSessionRef.current === recordingSession && event.data.size) recordedChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream?.getTracks().forEach((track) => track.stop());
        if (recordingSessionRef.current !== recordingSession) return;
        if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        recorderRef.current = null;
        const recordedAudio = new Blob(recordedChunksRef.current, { type: recorder.mimeType || mimeType });
        recordedChunksRef.current = [];
        void submitVoice(recordedAudio);
      };
      recorder.start();
      setVoiceState("recording");
      setNotice("");
      recordingTimerRef.current = window.setTimeout(() => { if (recordingSessionRef.current === recordingSession && recorder.state === "recording") recorder.stop(); }, 20_000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (recordingSessionRef.current === recordingSession) { setVoiceState("idle"); setNotice(t.voiceUnavailable); }
    }
  }

  function handleVoiceButton() {
    if (voiceState === "recording") {
      if (recorderRef.current) recorderRef.current.stop();
      else cancelVoiceRecording();
    } else if (voiceState === "playing" || voiceState === "processing") {
      cancelVoiceFlow();
      stopVoicePlayback();
    } else void startVoiceRecording();
  }

  async function submitVoice(audio: Blob) {
    if (!audio.size) return setVoiceState("idle");
    cancelVoiceFlow();
    stopVoicePlayback();
    const controller = new AbortController();
    voiceFlowRequestRef.current = controller;
    setVoiceState("processing");
    setPending(true);
    setNotice("");
    setFailedQuestion("");
    const context = messages.slice(-4).map(({ role, content }) => ({ role, content }));
    try {
      const arrayBuffer = await audio.arrayBuffer();
      throwIfEndoBotCancelled(controller.signal);
      let binary = "";
      const bytes = new Uint8Array(arrayBuffer);
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + 0x8000)));
      const sessionResult = await supabase.auth.getSession();
      throwIfEndoBotCancelled(controller.signal);
      const headers = createEndoBotRequestHeaders({ authenticated: isAuthenticated, accessToken: sessionResult.data.session?.access_token, sessionError: sessionResult.error, sessionExpiredMessage: t.sessionExpired });
      const transcription = await requestEndoBot<{ transcript?: string }>(`${apiBase}/api/endobot-voice`, { method: "POST", headers, body: JSON.stringify({ audioBase64: btoa(binary), mimeType: audio.type, preferredLanguage: language, transcribeOnly: true }), signal: controller.signal }, 75_000);
      throwIfEndoBotCancelled(controller.signal);
      const question = typeof transcription.transcript === "string" ? transcription.transcript.trim() : "";
      if (!question || question.length > 700) throw new EndoBotApiError(t.voiceUnavailable, 422, "transcription_failed");
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
      setMessages((current) => [...current, userMessage]);
      const assistantMessage = await answerQuestion(userMessage, context, controller.signal);
      throwIfEndoBotCancelled(controller.signal);
      voiceFlowRequestRef.current = null;
      setPending(false);
      setVoiceState("idle");
      if (assistantMessage) void speakReply(assistantMessage.content, assistantMessage.id!);
    } catch (error) {
      if (controller.signal.aborted) return;
      setVoiceState("idle");
      setNotice(error instanceof EndoBotApiError ? (error.code === "human_supervision_paused" ? t.humanTeamTakenOver : error.message) : t.voiceUnavailable);
    } finally {
      if (voiceFlowRequestRef.current === controller) {
        voiceFlowRequestRef.current = null;
        setPending(false);
      }
    }
  }

  return (
    <section id="endobot" className="section-shell endobot-section">
      <div className="endobot-intro">
        <span className="eyebrow"><Sparkles size={14} /> {t.eyebrow}</span>
        <h2>{t.title}</h2>
        <p>{t.intro}</p>
        <div className="bot-principles"><span><LockKeyhole size={14} /> {t.privacy}</span><span><ShieldAlert size={14} /> {t.noDiagnosis}</span></div>
        <p className="clinical-note">{savedHistory ? t.privateNote : t.transientNote}</p>
      </div>

      <div className="bot-workspace" aria-label={t.chatLabel}>
        <div className="bot-bar"><div><span className="bot-orb"><Bot size={16} /></span><div><strong>EndoBot</strong><small>{savedHistory ? t.privateHistory : t.temporarySession}</small></div></div><span className={`status-dot status-dot--${serviceStatus}`} aria-live="polite" aria-atomic="true">{serviceStatus === "available" ? t.available : serviceStatus === "checking" ? t.checking : t.unavailableStatus}</span></div>
        {isAuthenticated ? <div className="bot-archive">
          <div className="bot-archive__heading"><span><FolderOpen size={14} /> {t.conversations}</span><div className="bot-archive__actions"><button type="button" onClick={() => startNewChat()}><MessageCirclePlus size={14} /> {t.newChat}</button>{!humanTakeoverPaused ? <button type="button" onClick={() => startTemporaryChat()}>{t.temporaryChat}</button> : null}</div></div>
          <div className="bot-archive__filters"><select aria-label={t.filterCategories} value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as "all" | Category)}><option value="all">{t.allCategories}</option>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></div>
          <div className="bot-archive__list">{visibleConversations.length ? visibleConversations.map((item) => <div className="bot-archive__item" key={item.id}><button type="button" className={item.id === activeConversationId ? "is-active" : ""} onClick={() => void loadConversation(item)}><span>{categoryLabel(item.category)}</span><strong>{item.title}</strong></button><button className="bot-archive__delete" type="button" aria-label={t.deleteConversation} title={t.deleteConversation} onClick={() => void deleteConversation(item)}><Trash2 size={13} /></button></div>) : <p>{t.emptyConversations}</p>}</div>
          {archiveError ? <p className="chat-notice" role="status">{archiveError}</p> : null}
        </div> : null}
        <div className="endobot-chat" aria-live="polite">
          <div className="chat-controls">
            <label><Globe2 size={14} /> {t.languageLabel}<select value={language} onChange={(event) => changeLanguage(event.target.value as BotLanguage)}>{botLanguages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {savedHistory ? <label><FolderOpen size={14} /> {t.categoryLabel}<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label> : <small>{t.transientNote}</small>}
          </div>
          {savedHistory ? <div className={`endobot-human-consent ${activeConversationId && humanReviewConsent ? "is-active" : ""}`}><strong>{t.humanConsentTitle}</strong><p>{t.humanConsentDescription}</p>{activeConversationId && humanReviewConsent ? <button type="button" onClick={() => void updateHumanReviewConsent(false)}>{t.withdrawHumanConsent}</button> : null}</div> : null}
          <div className="chat-history" ref={chatHistoryRef} onScroll={handleHistoryScroll}>{messages.map((message, index) => {
            const key = message.id ?? `${message.role}-${index}`;
            const isSpeaking = speakingMessage === key;
            return <div key={key} className={`chat-message ${message.role}`}><span>{message.role === "assistant" ? "EndoBot" : message.role === "human" ? t.humanTeam : t.user}</span><p>{message.content}</p>{message.role === "assistant" && (index > 0 || activeConversationId) ? <button type="button" className="chat-speak" onClick={() => isSpeaking ? stopVoicePlayback() : void speakReply(message.content, key)} aria-label={isSpeaking ? t.stopAudio : t.hearReply}>{isSpeaking ? <Square size={13} /> : <Volume2 size={13} />}{isSpeaking ? (voiceState === "processing" ? t.preparingAudio : t.stopAudio) : t.hearReply}</button> : null}</div>;
          })}</div>
          {hasNewMessages ? <button type="button" className="chat-jump" onClick={scrollToLatest}>{t.jumpToLatest}</button> : null}
          {humanTakeoverPaused ? <p className="chat-notice chat-notice-human-takeover" role="status">{t.humanTeamTakenOver}</p> : serviceStatus === "unavailable" ? <div className="chat-notice chat-notice-unavailable" role="status"><p>{t.serviceUnavailable}</p><button type="button" className="voice-button" onClick={() => void availabilityCheckRef.current?.()}>{t.retryAvailability}</button></div> : null}
          {notice ? <p className="chat-notice" role="status">{notice}</p> : null}
          {failedQuestion && isAuthenticated && !humanTakeoverPaused && !blocksRestrictedFeatures(control) ? <button type="button" className="voice-button" disabled={pending} onClick={() => startTemporaryChat(failedQuestion)}>{t.recoverTemporaryChat}</button> : null}
          {isAuthenticated && blocksRestrictedFeatures(control) ? <p className="chat-notice chat-notice-restricted" role="alert">{t.restricted}</p> : <form onSubmit={sendMessage}>
            <label htmlFor="endobot-message">{t.question}</label>
            {!messages.some((message) => message.role === "user") ? <div className="endobot-suggestions" aria-label={t.suggestionsLabel}><span>{t.suggestionsLabel}</span><div>{t.suggestions.map((question) => <button key={question} type="button" onClick={() => useSuggestedQuestion(question)} disabled={serviceStatus === "unavailable" && !humanTakeoverPaused}>{question}</button>)}</div></div> : null}
            <textarea ref={composerRef} id="endobot-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleMessageComposerKeyDown} maxLength={700} autoComplete="off" spellCheck placeholder={t.placeholder} disabled={authLoading || (serviceStatus === "unavailable" && !humanTakeoverPaused)} />
            <button type="button" className="voice-preference" aria-pressed={readReplies} onClick={() => setReadReplies((current) => !current)}><Volume2 size={13} />{readReplies ? t.readRepliesOn : t.readRepliesOff}</button>
            <div className="chat-actions"><small>{t.privacyReminder}<br />{t.enterHint}<br />{t.voiceLocal}</small><div className="chat-action-buttons"><button className="voice-button" type="button" onClick={handleVoiceButton} disabled={voiceState === "idle" && (authLoading || pending || (serviceStatus === "unavailable" && !humanTakeoverPaused))} aria-label={voiceState === "recording" ? t.voiceStop : voiceState === "playing" || voiceState === "processing" ? t.stopAudio : t.voiceStart}>{voiceState === "recording" ? <Square size={15} /> : voiceState === "playing" || voiceState === "processing" ? <Square size={15} /> : <Mic size={15} />} {voiceState === "recording" ? t.voiceStop : voiceState === "processing" ? t.preparingAudio : voiceState === "playing" ? t.stopAudio : t.voiceStart}</button><button className="primary-button" type="submit" disabled={authLoading || !draft.trim() || pending || (serviceStatus === "unavailable" && !humanTakeoverPaused)}>{pending ? t.answering : <><Send size={15} /> {t.send}</>}</button></div></div>
          </form>}
        </div>
      </div>
    </section>
  );
}
