import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, BellRing, BellOff, MessageCircle, Send, Trash2, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { handleMessageComposerKeyDown } from "@/lib/messageComposer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type SupportedLanguage = "pt" | "en" | "es";
export type AdminChatMember = { user_id: string; display_name: string };
export type AdminChatMessage = { id: string; sender_id: string; body: string; mentioned_user_ids: string[]; created_at: string };

type AdminChatCopy = {
  title: string;
  intro: string;
  empty: string;
  loading: string;
  placeholder: string;
  send: string;
  sending: string;
  failure: string;
  mentionHint: string;
  soundOn: string;
  soundOff: string;
  soundHelp: string;
  self: string;
  memberFallback: string;
  mentionNotice: string;
  dismiss: string;
  delete: string;
  deleting: string;
  deleteTitle: string;
  deleteSelfDescription: string;
  deleteOwnerDescription: string;
  deleteConfirm: string;
  deleted: string;
};

const chatCopy: Record<SupportedLanguage, AdminChatCopy> = {
  pt: { title: "Chat da equipe", intro: "Conversa privada entre administradores, atualizada em tempo real.", empty: "Ainda não há mensagens. Envie a primeira para a equipe.", loading: "Carregando conversa…", placeholder: "Escreva para a equipe…", send: "Enviar", sending: "Enviando…", failure: "Não foi possível concluir esta ação agora.", mentionHint: "Mencione alguém:", soundOn: "Som de menções ativado", soundOff: "Som de menções desativado", soundHelp: "O navegador pode pedir uma interação antes de reproduzir o som.", self: "Você", memberFallback: "Administração", mentionNotice: "Você recebeu uma menção no chat administrativo.", dismiss: "Dispensar", delete: "Apagar", deleting: "Apagando…", deleteTitle: "Apagar mensagem?", deleteSelfDescription: "Sua mensagem será apagada definitivamente do chat. A ação ficará registrada internamente, sem copiar o texto.", deleteOwnerDescription: "Esta mensagem será apagada definitivamente do chat. A exclusão feita pelo Dono ficará registrada internamente, sem copiar o texto.", deleteConfirm: "Apagar mensagem", deleted: "Mensagem apagada." },
  en: { title: "Team chat", intro: "Private conversation between administrators, updated in real time.", empty: "There are no messages yet. Send the first one to the team.", loading: "Loading conversation…", placeholder: "Write to the team…", send: "Send", sending: "Sending…", failure: "This action could not be completed right now.", mentionHint: "Mention someone:", soundOn: "Mention sound enabled", soundOff: "Mention sound disabled", soundHelp: "Your browser may require an interaction before playing the sound.", self: "You", memberFallback: "Administration", mentionNotice: "You received a mention in the administrative chat.", dismiss: "Dismiss", delete: "Delete", deleting: "Deleting…", deleteTitle: "Delete message?", deleteSelfDescription: "Your message will be permanently removed from the chat. The action will be recorded internally without copying its text.", deleteOwnerDescription: "This message will be permanently removed from the chat. The Owner's deletion will be recorded internally without copying its text.", deleteConfirm: "Delete message", deleted: "Message deleted." },
  es: { title: "Chat del equipo", intro: "Conversación privada entre administradores, actualizada en tiempo real.", empty: "Aún no hay mensajes. Envía el primero al equipo.", loading: "Cargando conversación…", placeholder: "Escribe al equipo…", send: "Enviar", sending: "Enviando…", failure: "No fue posible completar esta acción ahora.", mentionHint: "Menciona a alguien:", soundOn: "Sonido de menciones activado", soundOff: "Sonido de menciones desactivado", soundHelp: "El navegador puede requerir una interacción antes de reproducir el sonido.", self: "Tú", memberFallback: "Administración", mentionNotice: "Recibiste una mención en el chat administrativo.", dismiss: "Descartar", delete: "Eliminar", deleting: "Eliminando…", deleteTitle: "¿Eliminar mensaje?", deleteSelfDescription: "Tu mensaje se eliminará definitivamente del chat. La acción quedará registrada internamente sin copiar el texto.", deleteOwnerDescription: "Este mensaje se eliminará definitivamente del chat. La eliminación hecha por el Dueño quedará registrada internamente sin copiar el texto.", deleteConfirm: "Eliminar mensaje", deleted: "Mensaje eliminado." },
};

export function normalizeAdminChatHandle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

export function extractAdminChatMentionIds(body: string, members: AdminChatMember[]) {
  const handles = new Map(members.map((member) => [normalizeAdminChatHandle(member.display_name), member.user_id]));
  const ids = new Set<string>();
  const pattern = /(^|[^A-Za-z0-9_-])@([A-Za-z0-9][A-Za-z0-9._-]{0,39})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const userId = handles.get(normalizeAdminChatHandle(match[2]));
    if (userId) ids.add(userId);
  }
  return Array.from(ids);
}

function splitAdminChatBody(body: string) {
  return body.split(/(@[A-Za-z0-9][A-Za-z0-9._-]{0,39})/g);
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function playMentionSound() {
  if (typeof window === "undefined") return;
  const AudioContextConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return;
  try {
    const context = new AudioContextConstructor();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.linearRampToValueAtTime(980, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
    oscillator.addEventListener("ended", () => void context.close());
    void context.resume().catch(() => undefined);
  } catch {
    // O navegador pode bloquear áudio fora de uma interação direta; o aviso visual continua disponível.
  }
}

function formatHandle(member: AdminChatMember) {
  return normalizeAdminChatHandle(member.display_name);
}

export function canDeleteAdminChatMessage(senderId: string, userId: string, canDeleteAny: boolean) {
  return senderId === userId || canDeleteAny;
}

export function AdminChat({ userId, language, locale, canChat, canDeleteAny = false }: { userId: string; language: SupportedLanguage; locale: string; canChat: boolean; canDeleteAny?: boolean }) {
  const t = chatCopy[language];
  const [members, setMembers] = useState<AdminChatMember[]>([]);
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [mentionNotice, setMentionNotice] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminChatMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window === "undefined" || window.localStorage.getItem("endoacolhe:admin-chat-sound") !== "off");
  const historyRef = useRef<HTMLDivElement>(null);

  const membersById = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const mentionMembers = useMemo(() => {
    const seen = new Set<string>();
    return members.filter((member) => {
      const handle = formatHandle(member);
      if (!handle || seen.has(handle)) return false;
      seen.add(handle);
      return true;
    });
  }, [members]);

  async function loadChat() {
    if (!canChat) return;
    setLoading(true);
    const [{ data: memberData, error: memberError }, { data: messageData, error: messageError }] = await Promise.all([
      supabase.rpc("list_endoacolhe_admin_chat_members"),
      supabase.from("admin_chat_messages").select("id,sender_id,body,mentioned_user_ids,created_at").order("created_at", { ascending: true }).limit(200),
    ]);
    if (memberError || messageError) setNotice(t.failure);
    else {
      setMembers((memberData ?? []) as AdminChatMember[]);
      setMessages((messageData ?? []) as AdminChatMessage[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!canChat) {
      setMembers([]);
      setMessages([]);
      return;
    }
    void loadChat();
  }, [canChat, userId]);

  useEffect(() => {
    if (!canChat) return;
    const channel = supabase
      .channel(`admin-chat-live-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_chat_messages" }, (payload) => {
        const incoming = payload.new as AdminChatMessage;
        setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_id !== userId && incoming.mentioned_user_ids?.includes(userId)) {
          setMentionNotice(true);
          if (soundEnabled) playMentionSound();
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "admin_chat_messages" }, (payload) => {
        const deleted = payload.old as Pick<AdminChatMessage, "id">;
        if (deleted.id) setMessages((current) => current.filter((message) => message.id !== deleted.id));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canChat, soundEnabled, userId]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [messages]);

  function toggleSound() {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem("endoacolhe:admin-chat-sound", next ? "on" : "off");
      return next;
    });
  }

  function insertMention(member: AdminChatMember) {
    const handle = formatHandle(member);
    if (!handle) return;
    setDraft((current) => `${current}${current && !/\s$/.test(current) ? " " : ""}@${handle} `);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!canChat || !body || sending) return;
    setSending(true);
    setNotice("");
    const { error } = await supabase.rpc("send_endoacolhe_admin_chat_message", {
      p_body: body,
      p_mentioned_user_ids: extractAdminChatMentionIds(body, members),
    });
    if (error) setNotice(t.failure);
    else {
      setDraft("");
      await loadChat();
    }
    setSending(false);
  }

  async function deleteMessage() {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setNotice("");
    const { error } = await supabase.rpc("delete_endoacolhe_admin_chat_message", { p_message_id: deleteTarget.id });
    if (error) setNotice(t.failure);
    else {
      setMessages((current) => current.filter((message) => message.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice(t.deleted);
    }
    setDeletingId(null);
  }

  function renderBody(body: string) {
    return splitAdminChatBody(body).map((part, index) => {
      if (!part.startsWith("@")) return <span key={`${part}-${index}`}>{part}</span>;
      const handle = normalizeAdminChatHandle(part.slice(1));
      const member = members.find((candidate) => formatHandle(candidate) === handle);
      return member ? <mark key={`${part}-${index}`} title={member.display_name}>{part}</mark> : <span key={`${part}-${index}`}>{part}</span>;
    });
  }

  return <section id="admin-chat" className="admin-panel admin-chat-panel" aria-labelledby="admin-chat-title">
    <div className="admin-panel__heading"><span><MessageCircle size={18} /><span id="admin-chat-title">{t.title}</span></span><button type="button" className={`admin-chat-sound ${soundEnabled ? "is-on" : "is-off"}`} onClick={toggleSound} aria-pressed={soundEnabled} title={soundEnabled ? t.soundOn : t.soundOff}>{soundEnabled ? <Volume2 size={15} /> : <BellOff size={15} />}{soundEnabled ? t.soundOn : t.soundOff}</button></div>
    <p className="admin-post-intro">{t.intro}</p>
    {mentionNotice ? <p className="admin-chat-mention-notice" role="alert"><BellRing size={15} />{t.mentionNotice}<button type="button" onClick={() => setMentionNotice(false)}>{t.dismiss}</button></p> : null}
    <div className="admin-chat-workspace">
      <div className="admin-chat-history" ref={historyRef} aria-live="polite">
        {loading ? <p className="admin-chat-empty"><MessageCircle size={22} />{t.loading}</p> : messages.length ? messages.map((message) => {
          const sender = message.sender_id === userId ? t.self : membersById.get(message.sender_id)?.display_name || t.memberFallback;
          const canDelete = canDeleteAdminChatMessage(message.sender_id, userId, canDeleteAny);
          return <article className={message.sender_id === userId ? "is-self" : ""} key={message.id}><div className="admin-chat-message-meta"><strong>{sender}</strong><span className="admin-chat-message-meta__actions"><time>{new Date(message.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time>{canDelete ? <button type="button" className="admin-chat-delete" onClick={() => setDeleteTarget(message)} disabled={deletingId === message.id} title={t.delete} aria-label={t.delete}>{<Trash2 size={13} />}</button> : null}</span></div><p>{renderBody(message.body)}</p></article>;
        }) : <p className="admin-chat-empty"><MessageCircle size={22} />{t.empty}</p>}
      </div>
      <form className="admin-chat-composer" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="admin-chat-message">{t.title}</label>
        <textarea id="admin-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleMessageComposerKeyDown} placeholder={t.placeholder} maxLength={1200} rows={3} required />
        <div className="admin-chat-composer-footer"><div className="admin-chat-mention-tools"><span><AtSign size={14} />{t.mentionHint}</span>{mentionMembers.map((member) => <button type="button" key={member.user_id} onClick={() => insertMention(member)}>{`@${formatHandle(member)}`}</button>)}</div><button className="admin-approve" type="submit" disabled={sending || !draft.trim()}>{sending ? t.sending : <><Send size={15} />{t.send}</>}</button></div>
        <small className="admin-chat-sound-help"><Volume2 size={13} />{t.soundHelp}</small>
      </form>
    </div>
    {notice ? <p className="admin-chat-notice" role="status">{notice}</p> : null}
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.sender_id === userId ? t.deleteSelfDescription : t.deleteOwnerDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={Boolean(deletingId)}>{t.dismiss}</AlertDialogCancel><AlertDialogAction className="admin-chat-delete-confirm" disabled={Boolean(deletingId)} onClick={(event) => { event.preventDefault(); void deleteMessage(); }}>{deletingId ? t.deleting : t.deleteConfirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
