import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MessageCircleHeart, PauseCircle, PlayCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { handleMessageComposerKeyDown } from "@/lib/messageComposer";
import { HUMAN_SUPERVISION_REPLY_LIMIT, isHumanSupervisionReplyValid, normalizeHumanSupervisionReply } from "@/lib/endoBotHumanSupervision";
import "./EndoBotOwnerSupervision.css";

type SiteLanguage = "pt" | "en" | "es";
type SupervisionConversation = {
  id: string;
  category: string;
  language: string;
  title: string;
  updated_at: string;
  human_takeover_status: "automated" | "paused";
  human_takeover_at: string | null;
  message_count: number;
};
type SupervisionMessage = { id: string; role: "user" | "assistant" | "human"; content: string; created_at: string };

const copy = {
  pt: {
    title: "Supervisão humana do EndoBot",
    intro: "Fila restrita a conversas que receberam consentimento específico. Não mostra e-mail, identificadores de conta nem registros de auditoria.",
    refresh: "Atualizar fila",
    loading: "Carregando conversas consentidas…",
    empty: "Nenhuma conversa com consentimento disponível agora.",
    select: "Selecione uma conversa consentida para revisar.",
    conversation: "Conversa consentida",
    messageCount: "mensagens",
    paused: "Equipe humana assumiu",
    automated: "Automação ativa",
    pause: "Pausar EndoBot",
    resume: "Retomar EndoBot",
    composer: "Resposta da equipe humana",
    placeholder: "Escreva uma resposta acolhedora e responsável…",
    send: "Enviar como equipe humana",
    sending: "Enviando…",
    onlyPaused: "Pause a conversa antes de responder como equipe humana. A pessoa verá a identificação da equipe.",
    live: "Atualizações em tempo real ativas",
    error: "Não foi possível atualizar esta supervisão agora.",
    pauseTitle: "Assumir esta conversa como equipe humana?",
    pauseDescription: "O EndoBot deixará de gerar respostas automáticas nesta conversa até você retomar a automação. A pessoa receberá um aviso claro de que a equipe humana assumiu.",
    confirmPause: "Pausar e assumir",
    cancel: "Cancelar",
    user: "Pessoa usuária",
    assistant: "EndoBot",
    human: "Equipe humana do EndoCare",
    noMessages: "Ainda não há mensagens nesta conversa.",
    consent: "Consentimento ativo",
  },
  en: {
    title: "EndoBot human supervision",
    intro: "A restricted queue of conversations with specific consent. It does not show email addresses, account identifiers, or audit records.",
    refresh: "Refresh queue",
    loading: "Loading consented conversations…",
    empty: "There are no consented conversations available right now.",
    select: "Select a consented conversation to review.",
    conversation: "Consented conversation",
    messageCount: "messages",
    paused: "Human team has taken over",
    automated: "Automation active",
    pause: "Pause EndoBot",
    resume: "Resume EndoBot",
    composer: "Human team response",
    placeholder: "Write a supportive and responsible response…",
    send: "Send as human team",
    sending: "Sending…",
    onlyPaused: "Pause the conversation before replying as the human team. The person will see the team identification.",
    live: "Live updates active",
    error: "This supervision view could not be updated right now.",
    pauseTitle: "Take over this conversation as the human team?",
    pauseDescription: "EndoBot will stop generating automatic answers in this conversation until automation is resumed. The person will receive a clear notice that the human team has taken over.",
    confirmPause: "Pause and take over",
    cancel: "Cancel",
    user: "Person using the service",
    assistant: "EndoBot",
    human: "EndoCare human team",
    noMessages: "There are no messages in this conversation yet.",
    consent: "Active consent",
  },
  es: {
    title: "Supervisión humana de EndoBot",
    intro: "Una cola restringida a conversaciones con consentimiento específico. No muestra correos, identificadores de cuenta ni registros de auditoría.",
    refresh: "Actualizar cola",
    loading: "Cargando conversaciones con consentimiento…",
    empty: "No hay conversaciones con consentimiento disponibles ahora.",
    select: "Selecciona una conversación con consentimiento para revisarla.",
    conversation: "Conversación con consentimiento",
    messageCount: "mensajes",
    paused: "El equipo humano asumió",
    automated: "Automatización activa",
    pause: "Pausar EndoBot",
    resume: "Reanudar EndoBot",
    composer: "Respuesta del equipo humano",
    placeholder: "Escribe una respuesta acogedora y responsable…",
    send: "Enviar como equipo humano",
    sending: "Enviando…",
    onlyPaused: "Pausa la conversación antes de responder como equipo humano. La persona verá la identificación del equipo.",
    live: "Actualizaciones en tiempo real activas",
    error: "No fue posible actualizar esta supervisión ahora.",
    pauseTitle: "¿Asumir esta conversación como equipo humano?",
    pauseDescription: "EndoBot dejará de generar respuestas automáticas en esta conversación hasta que reanudes la automatización. La persona recibirá un aviso claro de que el equipo humano asumió.",
    confirmPause: "Pausar y asumir",
    cancel: "Cancelar",
    user: "Persona usuaria",
    assistant: "EndoBot",
    human: "Equipo humano de EndoCare",
    noMessages: "Aún no hay mensajes en esta conversación.",
    consent: "Consentimiento activo",
  },
} as const;

export function EndoBotOwnerSupervision({ language, locale }: { language: SiteLanguage; locale: string }) {
  const t = copy[language];
  const [queue, setQueue] = useState<SupervisionConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupervisionMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [notice, setNotice] = useState("");
  const [pauseConfirmationOpen, setPauseConfirmationOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const selectedConversation = useMemo(() => queue.find((conversation) => conversation.id === selectedId) ?? null, [queue, selectedId]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_endoacolhe_human_supervision_conversations", { p_limit: 40 });
    if (error) {
      setNotice(t.error);
      setLoading(false);
      return;
    }
    const nextQueue = (data ?? []) as SupervisionConversation[];
    setQueue(nextQueue);
    setSelectedId((current) => nextQueue.some((conversation) => conversation.id === current) ? current : nextQueue[0]?.id ?? null);
    setLoading(false);
  }, [t.error]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase.rpc("list_endoacolhe_human_supervision_messages", { p_conversation_id: conversationId });
    if (error) setNotice(t.error); else setMessages((data ?? []) as SupervisionMessage[]);
    setLoadingMessages(false);
  }, [t.error]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId); else setMessages([]);
  }, [loadMessages, selectedId]);

  useEffect(() => {
    const channel = supabase
      .channel("owner-endobot-human-supervision")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_realtime_signal" }, () => {
        void loadQueue();
        if (selectedId) void loadMessages(selectedId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, loadQueue, selectedId]);

  async function changeTakeoverStatus(paused: boolean) {
    if (!selectedConversation || changingStatus) return;
    setChangingStatus(true);
    setNotice("");
    const { error } = await supabase.rpc("set_endoacolhe_human_supervision_pause", { p_conversation_id: selectedConversation.id, p_paused: paused });
    if (error) setNotice(t.error); else { await loadQueue(); await loadMessages(selectedConversation.id); }
    setChangingStatus(false);
    setPauseConfirmationOpen(false);
  }

  async function sendHumanReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = normalizeHumanSupervisionReply(draft);
    if (!selectedConversation || selectedConversation.human_takeover_status !== "paused" || sending || !isHumanSupervisionReplyValid(content)) return;
    setSending(true);
    setNotice("");
    const { error } = await supabase.rpc("add_endoacolhe_human_supervision_reply", { p_conversation_id: selectedConversation.id, p_content: content });
    if (error) setNotice(t.error); else { setDraft(""); await loadMessages(selectedConversation.id); await loadQueue(); }
    setSending(false);
  }

  return <section id="admin-endobot-supervision" className="admin-panel endobot-supervision-panel" aria-labelledby="endobot-supervision-title">
    <div className="admin-panel__heading">
      <span><MessageCircleHeart size={18} /><span id="endobot-supervision-title">{t.title}</span></span>
      <button type="button" className="admin-refresh" onClick={() => void loadQueue()} disabled={loading}><RefreshCw className={loading ? "admin-spinner" : ""} size={15} />{t.refresh}</button>
    </div>
    <p className="admin-post-intro">{t.intro}</p>
    <p className="endobot-supervision-live"><ShieldCheck size={15} />{t.live}</p>
    {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
    <div className="endobot-supervision-workspace">
      <div className="endobot-supervision-queue" aria-label={t.title}>
        {loading ? <p className="endobot-supervision-loading"><RefreshCw className="admin-spinner" size={16} />{t.loading}</p> : queue.length ? queue.map((conversation) => <button type="button" key={conversation.id} className={conversation.id === selectedId ? "is-selected" : ""} onClick={() => setSelectedId(conversation.id)}>
          <span><em>{t.consent}</em><time>{new Date(conversation.updated_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></span>
          <strong>{conversation.title || conversation.category}</strong>
          <small>{conversation.category} · {conversation.language.toUpperCase()} · {conversation.message_count} {t.messageCount}</small>
          <b className={conversation.human_takeover_status === "paused" ? "is-paused" : "is-automated"}>{conversation.human_takeover_status === "paused" ? t.paused : t.automated}</b>
        </button>) : <p className="endobot-supervision-empty">{t.empty}</p>}
      </div>
      <div className="endobot-supervision-conversation">
        {!selectedConversation ? <div className="admin-empty"><MessageCircleHeart size={25} /><p>{t.select}</p></div> : <>
          <div className="endobot-supervision-conversation__heading"><div><span>{t.conversation}</span><h3>{selectedConversation.title || selectedConversation.category}</h3><p>{selectedConversation.category} · {selectedConversation.language.toUpperCase()}</p></div><div><b className={selectedConversation.human_takeover_status === "paused" ? "is-paused" : "is-automated"}>{selectedConversation.human_takeover_status === "paused" ? t.paused : t.automated}</b>{selectedConversation.human_takeover_status === "paused" ? <button type="button" className="endobot-supervision-resume" onClick={() => void changeTakeoverStatus(false)} disabled={changingStatus}><PlayCircle size={16} />{t.resume}</button> : <button type="button" className="endobot-supervision-pause" onClick={() => setPauseConfirmationOpen(true)} disabled={changingStatus}><PauseCircle size={16} />{t.pause}</button>}</div></div>
          <div className="endobot-supervision-messages" aria-live="polite">{loadingMessages ? <p className="endobot-supervision-loading"><RefreshCw className="admin-spinner" size={16} />{t.loading}</p> : messages.length ? messages.map((message) => <article className={`is-${message.role}`} key={message.id}><strong>{message.role === "human" ? t.human : message.role === "assistant" ? t.assistant : t.user}</strong><p>{message.content}</p><time>{new Date(message.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></article>) : <p className="endobot-supervision-empty">{t.noMessages}</p>}</div>
          <form className="endobot-supervision-composer" onSubmit={sendHumanReply}><label htmlFor="endobot-human-reply">{t.composer}</label><textarea id="endobot-human-reply" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleMessageComposerKeyDown} placeholder={t.placeholder} maxLength={HUMAN_SUPERVISION_REPLY_LIMIT} rows={3} disabled={selectedConversation.human_takeover_status !== "paused" || sending} /><div><small>{selectedConversation.human_takeover_status === "paused" ? `${draft.length}/${HUMAN_SUPERVISION_REPLY_LIMIT}` : t.onlyPaused}</small><button type="submit" className="admin-approve" disabled={selectedConversation.human_takeover_status !== "paused" || sending || !isHumanSupervisionReplyValid(draft)}>{sending ? <RefreshCw className="admin-spinner" size={15} /> : <Send size={15} />}{sending ? t.sending : t.send}</button></div></form>
        </>}
      </div>
    </div>
    <AlertDialog open={pauseConfirmationOpen} onOpenChange={(open) => { if (!changingStatus) setPauseConfirmationOpen(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.pauseTitle}</AlertDialogTitle><AlertDialogDescription>{t.pauseDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={changingStatus}>{t.cancel}</AlertDialogCancel><AlertDialogAction className="endobot-supervision-pause" disabled={changingStatus} onClick={(event) => { event.preventDefault(); void changeTakeoverStatus(true); }}>{changingStatus ? <RefreshCw className="admin-spinner" size={15} /> : <PauseCircle size={15} />}{t.confirmPause}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
