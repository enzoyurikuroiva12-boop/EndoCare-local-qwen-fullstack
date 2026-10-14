import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Mail, RefreshCw, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { reserveAuthAttempt } from "@/lib/authRateLimit";
import { isPasswordValid } from "@/lib/passwordPolicy";
import { supabase } from "@/lib/supabase";
import { buildSignupLegalMetadata, legalVersions, publicLegalCopy } from "@/lib/legalContent";
import { navigateWithTransition } from "@/lib/pageNavigation";
import "./AuthDialog.css";

export const authCopy = {
  pt: { captcha: "Não foi possível concluir a verificação de segurança agora. Aguarde alguns instantes e tente novamente.", wait: (seconds: number) => `Por segurança, aguarde cerca de ${seconds}s antes de tentar novamente.`, loginFailure: "Não foi possível entrar. Confira seu e-mail e senha e tente novamente.", signupFailure: "Não foi possível criar a conta. Revise os dados e tente novamente.", loginSuccess: "Login realizado.", signupSuccess: "Enviamos um link de confirmação para seu e-mail.", linkTitle: "Confirme seu e-mail", linkIntro: (email: string) => `Enviamos um link de confirmação para ${email || "seu e-mail"}. Abra-o para ativar a conta e entrar no EndoCare.`, linkInstruction: "O link expira por segurança. Se não o encontrar, verifique também a pasta de spam.", resendFailure: "Não foi possível reenviar o link agora. Tente novamente em alguns minutos.", resendSuccess: "Novo link de confirmação enviado para seu e-mail.", passwordInvalid: "Crie uma senha com 10 caracteres, letra maiúscula, número, caractere especial e sem repetição excessiva.", recoveryTitle: "Recupere seu acesso", recoveryIntro: "Informe seu e-mail e enviaremos um link privado para você escolher uma nova senha.", recoveryAction: "Enviar link de recuperação", recoverySent: "Se houver uma conta com este e-mail, enviaremos um link de recuperação.", recoveryFailure: "Não foi possível solicitar a recuperação agora.", forgotPassword: "Esqueci minha senha", backToLogin: "Voltar para entrar", loginTitle: "Que bom ter você aqui", signupTitle: "Crie seu espaço", loginIntro: "Entre para registrar sua jornada e retomar suas anotações com privacidade.", signupIntro: "Organize suas anotações e conversas de cuidado em uma conta pessoal.", close: "Fechar acesso", name: "Como você prefere ser chamada?", email: "E-mail", password: "Senha", emailPlaceholder: "voce@exemplo.com", passwordPlaceholder: "Informe sua senha", showPassword: "Mostrar senha", hidePassword: "Ocultar senha", waiting: "Aguarde…", signIn: "Entrar na minha conta", createAccountAction: "Criar conta e enviar link", resendLink: "Reenviar link", changeEmail: "Alterar e-mail", createAccount: "Ainda não tenho conta", existingAccount: "Já tenho conta", privacy: "Seu acesso é privado. Não mostramos seu e-mail na navegação." },
  en: { captcha: "The security check could not be completed right now. Wait a moment and try again.", wait: (seconds: number) => `For security, wait about ${seconds}s before trying again.`, loginFailure: "Unable to sign in. Check your email and password and try again.", signupFailure: "Unable to create the account. Review your details and try again.", loginSuccess: "Signed in successfully.", signupSuccess: "We sent a confirmation link to your email.", linkTitle: "Confirm your email", linkIntro: (email: string) => `We sent a confirmation link to ${email || "your email"}. Open it to activate your account and sign in to EndoCare.`, linkInstruction: "The link expires for security. If you cannot find it, also check your spam folder.", resendFailure: "Unable to resend the link right now. Try again in a few minutes.", resendSuccess: "A new confirmation link was sent to your email.", passwordInvalid: "Create a password with 10 characters, an uppercase letter, a number, a special character, and no excessive repetition.", recoveryTitle: "Recover your access", recoveryIntro: "Enter your email and we will send a private link for you to choose a new password.", recoveryAction: "Send recovery link", recoverySent: "If an account exists with this email, we will send a recovery link.", recoveryFailure: "Unable to request recovery right now.", forgotPassword: "I forgot my password", backToLogin: "Back to sign in", loginTitle: "Welcome back", signupTitle: "Create your space", loginIntro: "Sign in to record your journey and return to your notes with privacy.", signupIntro: "Organize your notes and care conversations in a personal account.", close: "Close access", name: "How would you like to be called?", email: "Email", password: "Password", emailPlaceholder: "you@example.com", passwordPlaceholder: "Enter your password", showPassword: "Show password", hidePassword: "Hide password", waiting: "Please wait…", signIn: "Sign in to my account", createAccountAction: "Create account and send link", resendLink: "Resend link", changeEmail: "Change email", createAccount: "I don't have an account yet", existingAccount: "I already have an account", privacy: "Your access is private. We do not show your email in navigation." },
  es: { captcha: "No fue posible completar la verificación de seguridad ahora. Espera un momento e inténtalo de nuevo.", wait: (seconds: number) => `Por seguridad, espera aproximadamente ${seconds}s antes de volver a intentarlo.`, loginFailure: "No fue posible iniciar sesión. Revisa tu correo y contraseña e inténtalo de nuevo.", signupFailure: "No fue posible crear la cuenta. Revisa los datos e inténtalo de nuevo.", loginSuccess: "Sesión iniciada correctamente.", signupSuccess: "Enviamos un enlace de confirmación a tu correo.", linkTitle: "Confirma tu correo", linkIntro: (email: string) => `Enviamos un enlace de confirmación a ${email || "tu correo"}. Ábrelo para activar la cuenta e iniciar sesión en EndoCare.`, linkInstruction: "El enlace vence por seguridad. Si no lo encuentras, revisa también la carpeta de spam.", resendFailure: "No fue posible reenviar el enlace ahora. Inténtalo de nuevo en unos minutos.", resendSuccess: "Se envió un nuevo enlace de confirmación a tu correo.", passwordInvalid: "Crea una contraseña con 10 caracteres, una letra mayúscula, un número, un carácter especial y sin repetición excesiva.", recoveryTitle: "Recupera tu acceso", recoveryIntro: "Indica tu correo y te enviaremos un enlace privado para elegir una contraseña nueva.", recoveryAction: "Enviar enlace de recuperación", recoverySent: "Si existe una cuenta con este correo, enviaremos un enlace de recuperación.", recoveryFailure: "No fue posible solicitar la recuperación ahora.", forgotPassword: "Olvidé mi contraseña", backToLogin: "Volver a entrar", loginTitle: "Qué bueno tenerte aquí", signupTitle: "Crea tu espacio", loginIntro: "Inicia sesión para registrar tu recorrido y retomar tus notas con privacidad.", signupIntro: "Organiza tus anotaciones y conversaciones de cuidado en una cuenta personal.", close: "Cerrar acceso", name: "¿Cómo prefieres que te llamemos?", email: "Correo", password: "Contraseña", emailPlaceholder: "tu@ejemplo.com", passwordPlaceholder: "Escribe tu contraseña", showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña", waiting: "Espera…", signIn: "Entrar a mi cuenta", createAccountAction: "Crear cuenta y enviar enlace", resendLink: "Reenviar enlace", changeEmail: "Cambiar correo", createAccount: "Aún no tengo cuenta", existingAccount: "Ya tengo cuenta", privacy: "Tu acceso es privado. No mostramos tu correo en la navegación." },
} as const;

type AuthMode = "login" | "signup" | "link-sent" | "recovery";

const consentCopy = {
  pt: { required: "Para criar a conta, leia e aceite os dois documentos.", terms: "Li e aceito os", privacy: "Li e aceito a" },
  en: { required: "To create an account, read and accept both documents.", terms: "I have read and accept the", privacy: "I have read and accept the" },
  es: { required: "Para crear la cuenta, lee y acepta ambos documentos.", terms: "Leí y acepto los", privacy: "Leí y acepto la" },
} as const;

function authErrorMessage(error: { message?: string } | null, fallback: string, captcha: string) {
  return error?.message?.toLowerCase().includes("captcha") ? captcha : fallback;
}

export function AuthDialog() {
  const { language } = useSiteLanguage();
  const t = authCopy[language];
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = () => {
      setMode("login");
      setEmail("");
      setPassword("");
      setName("");
      setTermsAccepted(false);
      setPrivacyAccepted(false);
      setLoading(false);
      setOpen(true);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("endoacolhe:open-auth", listener);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("endoacolhe:open-auth", listener); window.removeEventListener("keydown", closeOnEscape); };
  }, []);

  function reserve(action: "email-login" | "email-signup" | "resend-link" | "password-recovery-request") {
    const result = reserveAuthAttempt(action);
    if (!result.allowed) toast.error(t.wait(result.retryAfterSeconds));
    return result.allowed;
  }

  function returnToLogin() {
    setMode("login");
    setPassword("");
    setName("");
    setTermsAccepted(false);
    setPrivacyAccepted(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "recovery") return requestPasswordRecovery();
    if (!reserve(mode === "login" ? "email-login" : "email-signup")) return;
    if (mode === "signup" && !isPasswordValid(password)) return toast.error(t.passwordInvalid);
    if (mode === "signup" && (!termsAccepted || !privacyAccepted)) return toast.error(consentCopy[language].required);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      : await supabase.auth.signUp({ email: normalizedEmail, password, options: { data: buildSignupLegalMetadata(name), emailRedirectTo: window.location.origin } });
    setLoading(false);
    if (result.error) return toast.error(authErrorMessage(result.error, mode === "login" ? t.loginFailure : t.signupFailure, t.captcha));
    if (mode === "login") { toast.success(t.loginSuccess); setOpen(false); return; }
    if (result.data.session) { toast.success(t.loginSuccess); setOpen(false); return; }
    setPassword("");
    setMode("link-sent");
    toast.success(t.signupSuccess);
  }

  async function resendEmailLink() {
    if (!reserve("resend-link")) return;
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const result = await supabase.auth.resend({ type: "signup", email: normalizedEmail, options: { emailRedirectTo: window.location.origin } });
    setLoading(false);
    if (result.error) return toast.error(t.resendFailure);
    toast.success(t.resendSuccess);
  }

  async function requestPasswordRecovery() {
    if (!reserve("password-recovery-request")) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/` });
    setLoading(false);
    if (error) return toast.error(t.recoveryFailure);
    toast.success(t.recoverySent);
    returnToLogin();
  }

  if (!open) return null;
  const isLogin = mode === "login";
  const isRecovery = mode === "recovery";
  const isLinkSent = mode === "link-sent";
  const isSignup = mode === "signup";
  const normalizedEmail = email.trim().toLowerCase();
  const title = isLinkSent ? t.linkTitle : isRecovery ? t.recoveryTitle : isLogin ? t.loginTitle : t.signupTitle;
  const intro = isLinkSent ? t.linkIntro(normalizedEmail) : isRecovery ? t.recoveryIntro : isLogin ? t.loginIntro : t.signupIntro;
  const consent = consentCopy[language];
  const legal = publicLegalCopy[language];
  const openDocument = (path: string) => { setOpen(false); navigateWithTransition(path); };

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header className="auth-dialog__header">
          <div className="auth-dialog__identity"><span className="auth-dialog__mark"><LockKeyhole size={19} /></span><div><span className="auth-dialog__eyebrow">EndoCare</span><strong className="auth-dialog__title" id="auth-title">{title}</strong></div></div>
          <button className="auth-dialog__close" type="button" onClick={() => setOpen(false)} aria-label={t.close}><X size={18} /></button>
        </header>
        <div className="auth-dialog__body">
          <p className="auth-dialog__intro">{intro}</p>
          {isLinkSent ? <div className="auth-link-sent" role="status"><Mail size={18} /><p>{t.linkInstruction}</p></div> : <form className="auth-form" onSubmit={submit}>
            {isRecovery ? <label className="auth-field"><span><Mail size={14} />{t.email}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" autoCapitalize="none" maxLength={160} placeholder={t.emailPlaceholder} required /></label> : <>
              {isSignup && <label className="auth-field"><span><UserRound size={14} />{t.name}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="name" required /></label>}
              <label className="auth-field"><span><Mail size={14} />{t.email}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" autoCapitalize="none" maxLength={160} placeholder={t.emailPlaceholder} required /></label>
              {(isLogin || isSignup) && <label className="auth-field"><span><LockKeyhole size={14} />{t.password}</span><PasswordInput value={password} onChange={event => setPassword(event.target.value)} minLength={isSignup ? 10 : 1} maxLength={128} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={t.passwordPlaceholder} required showLabel={t.showPassword} hideLabel={t.hidePassword} /></label>}
              {isSignup && <><PasswordStrengthMeter password={password} /><fieldset className="auth-consent"><legend>{consent.required}</legend><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required /><span>{consent.terms} <button type="button" onClick={() => openDocument("/termos")}>{legal.termsTitle}</button> ({legalVersions.terms}).</span></label><label><input type="checkbox" checked={privacyAccepted} onChange={event => setPrivacyAccepted(event.target.checked)} required /><span>{consent.privacy} <button type="button" onClick={() => openDocument("/privacidade")}>{legal.privacyTitle}</button> ({legalVersions.privacy}).</span></label></fieldset></>}
            </>}
            <button className="auth-submit" disabled={loading || (isSignup && (!termsAccepted || !privacyAccepted))} type="submit">{loading ? t.waiting : isRecovery ? t.recoveryAction : isLogin ? t.signIn : t.createAccountAction}</button>
          </form>}
          {isLinkSent ? <><button type="button" className="auth-mode-toggle auth-resend" onClick={resendEmailLink} disabled={loading}><RefreshCw size={13} />{t.resendLink}</button><button type="button" className="auth-mode-toggle" onClick={returnToLogin}>{t.backToLogin}</button></> : isRecovery ? <button type="button" className="auth-mode-toggle" onClick={returnToLogin}>{t.backToLogin}</button> : isLogin ? <><button type="button" className="auth-mode-toggle auth-resend" onClick={() => setMode("recovery")}>{t.forgotPassword}</button><button type="button" className="auth-mode-toggle" onClick={() => setMode("signup")}>{t.createAccount}</button></> : <button type="button" className="auth-mode-toggle" onClick={returnToLogin}>{t.existingAccount}</button>}
          <p className="auth-dialog__footer"><ShieldCheck size={13} />{t.privacy}</p>
        </div>
      </section>
    </div>
  );
}
