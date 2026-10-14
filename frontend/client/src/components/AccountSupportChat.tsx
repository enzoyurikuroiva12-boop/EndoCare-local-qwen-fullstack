import { FormEvent, useEffect, useRef, useState } from "react";
import { Headphones, Send } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAccountControl } from "@/contexts/AccountControlContext";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { supabase } from "@/lib/supabase";
import { handleMessageComposerKeyDown } from "@/lib/messageComposer";

type SupportThread = { id: string };
type SupportMessage = { id: string; sender_id: string | null; body: string; created_at: string };

const copy = {
  pt: { title: "Falar com a administração", description: "Envie uma mensagem para pedir esclarecimentos sobre esta medida. A conversa é privada.", empty: "Envie sua dúvida para iniciar o atendimento.", placeholder: "Escreva sua mensagem…", send: "Enviar", sending: "Enviando…", failure: "Não foi possível enviar sua mensagem agora.", enterHint: "Enter envia · Shift + Enter quebra a linha", you: "Você", administration: "Administração" },
  en: { title: "Contact administration", description: "Send a message to ask for clarification about this measure. This conversation is private.", empty: "Send your question to start the support request.", placeholder: "Write your message…", send: "Send", sending: "Sending…", failure: "Your message could not be sent right now.", enterHint: "Enter sends · Shift + Enter adds a line", you: "You", administration: "Administration" },
  es: { title: "Hablar con administración", description: "Envía un mensaje para pedir aclaraciones sobre esta medida. La conversación es privada.", empty: "Envía tu duda para iniciar la atención.", placeholder: "Escribe tu mensaje…", send: "Enviar", sending: "Enviando…", failure: "No fue posible enviar tu mensaje ahora.", enterHint: "Enter envía · Shift + Enter agrega una línea", you: "Tú", administration: "Administración" },
} as const;

export function AccountSupportChat({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { control } = useAccountControl();
  const { language, locale } = useSiteLanguage();
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  const t = copy[language];

  const loadMessages = async (threadId: string) => {
    const { data } = await supabase.from("account_support_messages").select("id,sender_id,body,created_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(100);
    setMessages((data ?? []) as SupportMessage[]);
  };

  useEffect(() => {
    if (!user || (control.status !== "restricted" && control.status !== "suspended")) { setThread(null); setMessages([]); return; }
    let active = true;
    void supabase.from("account_support_threads").select("id").eq("requester_id", user.id).eq("status", "open").maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      setThread(data as SupportThread);
      void loadMessages((data as SupportThread).id);
    });
    return () => { active = false; };
  }, [control.status, user?.id]);

  useEffect(() => {
    if (!thread) return;
    const channel = supabase
      .channel(`account-support-${thread.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_support_messages", filter: `thread_id=eq.${thread.id}` }, () => void loadMessages(thread.id))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [thread?.id]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [messages]);

  async function ensureThread() {
    if (thread) return thread.id;
    const { data, error } = await supabase.rpc("open_endoacolhe_account_support");
    if (error || !data) throw error ?? new Error("support unavailable");
    const next = { id: data as string };
    setThread(next);
    return next.id;
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!user || !body || sending) return;
    setSending(true); setNotice("");
    try {
      const threadId = await ensureThread();
      const { error } = await supabase.from("account_support_messages").insert({ thread_id: threadId, sender_id: user.id, body });
      if (error) throw error;
      setDraft("");
      void loadMessages(threadId);
    } catch { setNotice(t.failure); }
    setSending(false);
  }

  return <section className={`account-support-chat ${className}`} aria-label={t.title}>
    <header><span><Headphones size={17} /><strong>{t.title}</strong></span><p>{t.description}</p></header>
    <div className="account-support-history" ref={historyRef} aria-live="polite">
      {messages.length ? messages.map((message) => <div className={`account-support-message ${message.sender_id === user?.id ? "is-user" : "is-admin"}`} key={message.id}><span>{message.sender_id === user?.id ? t.you : t.administration}</span><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time></div>) : <p className="account-support-empty">{t.empty}</p>}
    </div>
    {notice ? <p className="account-support-notice" role="status">{notice}</p> : null}
    <form onSubmit={sendMessage}><label className="sr-only" htmlFor="account-support-message">{t.title}</label><textarea id="account-support-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleMessageComposerKeyDown} placeholder={t.placeholder} maxLength={1200} rows={3} required /><small className="account-support-composer-hint">{t.enterHint}</small><button type="submit" disabled={sending || !draft.trim()}>{sending ? t.sending : <><Send size={15} />{t.send}</>}</button></form>
  </section>;
}
