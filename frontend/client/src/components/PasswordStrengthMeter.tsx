import { Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { evaluatePassword } from "@/lib/passwordPolicy";
import "./PasswordStrengthMeter.css";

const meterCopy = {
  pt: { title: "Segurança da senha", weak: "Fraca", good: "Boa", secure: "Segura", length: "Pelo menos 10 caracteres", uppercase: "Uma letra maiúscula", digit: "Um número", special: "Um caractere especial", repetition: "Sem repetir a mesma sequência 3 vezes" },
  en: { title: "Password security", weak: "Weak", good: "Good", secure: "Secure", length: "At least 10 characters", uppercase: "One uppercase letter", digit: "One number", special: "One special character", repetition: "Do not repeat the same sequence 3 times" },
  es: { title: "Seguridad de la contraseña", weak: "Débil", good: "Buena", secure: "Segura", length: "Al menos 10 caracteres", uppercase: "Una letra mayúscula", digit: "Un número", special: "Un carácter especial", repetition: "No repitas la misma secuencia 3 veces" },
} as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { language } = useSiteLanguage();
  const t = meterCopy[language];
  const evaluation = evaluatePassword(password);
  const state = password ? evaluation.strength : "weak";
  const requirements = [
    [evaluation.hasMinimumLength, t.length],
    [evaluation.hasUppercase, t.uppercase],
    [evaluation.hasDigit, t.digit],
    [evaluation.hasSpecialCharacter, t.special],
    [!evaluation.hasRepeatedPattern, t.repetition],
  ] as const;

  return <div className="password-strength" data-strength={state} aria-live="polite">
    <div className="password-strength__heading"><span>{t.title}</span><strong>{state === "weak" ? t.weak : state === "good" ? t.good : t.secure}</strong></div>
    <div className="password-strength__bar" role="progressbar" aria-label={t.title} aria-valuemin={0} aria-valuemax={5} aria-valuenow={password ? evaluation.score : 0}><i style={{ transform: `scaleX(${password ? Math.max(evaluation.score, 1) / 5 : 0})` }} /></div>
    <ul>{requirements.map(([passed, label]) => <li data-passed={passed ? "true" : "false"} key={label}>{passed ? <Check size={13} /> : <ShieldAlert size={13} />}<span>{label}</span></li>)}</ul>
    {evaluation.isValid && <p><ShieldCheck size={13} />{state === "secure" ? t.secure : t.good}</p>}
  </div>;
}
