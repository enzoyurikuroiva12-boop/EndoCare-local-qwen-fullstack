import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, KeyRound, LoaderCircle, LockKeyhole, LogOut, Save, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import { reserveAuthAttempt } from "@/lib/authRateLimit";
import { isPasswordValid } from "@/lib/passwordPolicy";
import { isProfilePhotoMimeType, PROFILE_PHOTO_ACCEPT, PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_BUCKET } from "@/lib/profilePhoto";
import { supabase } from "@/lib/supabase";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ProfilePhotoEditor } from "@/components/ProfilePhotoEditor";
import "./AccountSettingsDialog.css";

const accountCopy = {
  pt: { title: "Configurações da conta", intro: "Atualize seu nome, foto ou senha. Seus dados de acesso permanecem privados.", close: "Fechar configurações", name: "Nome exibido", namePlaceholder: "Como você prefere ser chamada?", saveName: "Salvar nome", nameSuccess: "Nome atualizado.", nameFailure: "Não foi possível atualizar o nome agora.", photoTitle: "Foto de perfil", photoHint: "JPG, PNG ou WebP de até 5 MB.", photoEditorTitle: "Ajuste sua foto", photoEditorHelper: "Arraste a imagem ou use os controles para escolher o enquadramento.", photoEditorZoom: "Zoom", photoEditorHorizontal: "Horizontal", photoEditorVertical: "Vertical", photoEditorCancel: "Cancelar", photoEditorApply: "Usar este enquadramento", photoEditorPreparing: "Preparando…", choosePhoto: "Escolher foto", changePhoto: "Trocar foto", removePhoto: "Remover foto", photoSuccess: "Foto de perfil atualizada.", photoRemoved: "Foto de perfil removida.", photoFailure: "Não foi possível atualizar a foto agora.", photoInvalidType: "Escolha uma imagem JPG, PNG ou WebP.", photoTooLarge: "A foto precisa ter no máximo 5 MB.", passwordTitle: "Trocar senha", password: "Nova senha", confirmPassword: "Confirmar nova senha", passwordHint: "Use uma senha forte e siga todos os requisitos indicados abaixo.", savePassword: "Atualizar senha", passwordSuccess: "Senha atualizada.", passwordFailure: "Não foi possível atualizar a senha agora.", passwordsMismatch: "As senhas não coincidem.", passwordInvalid: "Revise os requisitos de segurança da senha.", showPassword: "Mostrar senha", hidePassword: "Ocultar senha", wait: (seconds: number) => `Por segurança, aguarde cerca de ${seconds}s antes de tentar novamente.`, privacy: "Não exibimos seu e-mail na navegação.", logout: "Sair da conta", saving: "Salvando…" },
  en: { title: "Account settings", intro: "Update your name, photo, or password. Your access details remain private.", close: "Close settings", name: "Display name", namePlaceholder: "How would you like to be called?", saveName: "Save name", nameSuccess: "Name updated.", nameFailure: "Unable to update your name right now.", photoTitle: "Profile photo", photoHint: "JPG, PNG, or WebP up to 5 MB.", photoEditorTitle: "Adjust your photo", photoEditorHelper: "Drag the image or use the controls to choose the crop.", photoEditorZoom: "Zoom", photoEditorHorizontal: "Horizontal", photoEditorVertical: "Vertical", photoEditorCancel: "Cancel", photoEditorApply: "Use this crop", photoEditorPreparing: "Preparing…", choosePhoto: "Choose photo", changePhoto: "Change photo", removePhoto: "Remove photo", photoSuccess: "Profile photo updated.", photoRemoved: "Profile photo removed.", photoFailure: "Unable to update the photo right now.", photoInvalidType: "Choose a JPG, PNG, or WebP image.", photoTooLarge: "The photo must be 5 MB or smaller.", passwordTitle: "Change password", password: "New password", confirmPassword: "Confirm new password", passwordHint: "Use a strong password and meet every requirement listed below.", savePassword: "Update password", passwordSuccess: "Password updated.", passwordFailure: "Unable to update your password right now.", passwordsMismatch: "Passwords do not match.", passwordInvalid: "Review the password security requirements.", showPassword: "Show password", hidePassword: "Hide password", wait: (seconds: number) => `For security, wait about ${seconds}s before trying again.`, privacy: "We do not show your email in navigation.", logout: "Sign out", saving: "Saving…" },
  es: { title: "Configuración de la cuenta", intro: "Actualiza tu nombre, foto o contraseña. Tus datos de acceso permanecen privados.", close: "Cerrar configuración", name: "Nombre mostrado", namePlaceholder: "¿Cómo prefieres que te llamemos?", saveName: "Guardar nombre", nameSuccess: "Nombre actualizado.", nameFailure: "No fue posible actualizar el nombre ahora.", photoTitle: "Foto de perfil", photoHint: "JPG, PNG o WebP de hasta 5 MB.", photoEditorTitle: "Ajusta tu foto", photoEditorHelper: "Arrastra la imagen o usa los controles para elegir el encuadre.", photoEditorZoom: "Zoom", photoEditorHorizontal: "Horizontal", photoEditorVertical: "Vertical", photoEditorCancel: "Cancelar", photoEditorApply: "Usar este encuadre", photoEditorPreparing: "Preparando…", choosePhoto: "Elegir foto", changePhoto: "Cambiar foto", removePhoto: "Quitar foto", photoSuccess: "Foto de perfil actualizada.", photoRemoved: "Foto de perfil quitada.", photoFailure: "No fue posible actualizar la foto ahora.", photoInvalidType: "Elige una imagen JPG, PNG o WebP.", photoTooLarge: "La foto debe tener como máximo 5 MB.", passwordTitle: "Cambiar contraseña", password: "Nueva contraseña", confirmPassword: "Confirmar nueva contraseña", passwordHint: "Usa una contraseña fuerte y cumple todos los requisitos indicados abajo.", savePassword: "Actualizar contraseña", passwordSuccess: "Contraseña actualizada.", passwordFailure: "No fue posible actualizar la contraseña ahora.", passwordsMismatch: "Las contraseñas no coinciden.", passwordInvalid: "Revisa los requisitos de seguridad de la contraseña.", showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña", wait: (seconds: number) => `Por seguridad, espera aproximadamente ${seconds}s antes de intentarlo de nuevo.`, privacy: "No mostramos tu correo en la navegación.", logout: "Cerrar sesión", saving: "Guardando…" },
} as const;

export { accountCopy };

type PendingPhoto = { src: string; width: number; height: number };

export function AccountSettingsDialog() {
  const { language } = useSiteLanguage();
  const t = accountCopy[language];
  const { user, isAuthenticated, refresh, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState<"name" | "password" | "photo" | "remove-photo" | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openSettings = () => {
      try { window.sessionStorage.removeItem("endoacolhe:password-recovery"); } catch { /* Sem armazenamento, a abertura continua funcionando. */ }
      setOpen(true);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("endoacolhe:open-account-settings", openSettings);
    window.addEventListener("keydown", closeOnEscape);
    try { if (window.sessionStorage.getItem("endoacolhe:password-recovery") === "1") openSettings(); } catch { /* Sem armazenamento, aguarda o evento de recuperação. */ }
    return () => { window.removeEventListener("endoacolhe:open-account-settings", openSettings); window.removeEventListener("keydown", closeOnEscape); };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!isAuthenticated || !user) { setOpen(false); return; }
    setName(user.name);
    setPassword("");
    setConfirmation("");
  }, [isAuthenticated, open, user]);

  useEffect(() => {
    return () => { if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.src); };
  }, [pendingPhoto]);

  const normalizedName = useMemo(() => name.trim().replace(/\s+/g, " ").slice(0, 80), [name]);
  if (!open || !isAuthenticated || !user) return null;
  const currentUserName = user.name;

  function reserve(action: "profile-update" | "password-update") {
    const result = reserveAuthAttempt(action);
    if (!result.allowed) toast.error(t.wait(result.retryAfterSeconds));
    return result.allowed;
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!normalizedName || normalizedName === currentUserName || !reserve("profile-update")) return;
    setSaving("name");
    const { error } = await supabase.auth.updateUser({ data: { name: normalizedName } });
    setSaving(null);
    if (error) return toast.error(t.nameFailure);
    await refresh();
    toast.success(t.nameSuccess);
  }

  function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!isProfilePhotoMimeType(file.type)) return toast.error(t.photoInvalidType);
    if (file.size > PROFILE_PHOTO_MAX_BYTES) return toast.error(t.photoTooLarge);
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setPendingPhoto({ src, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => { URL.revokeObjectURL(src); toast.error(t.photoFailure); };
    image.src = src;
  }

  async function saveCroppedPhoto(blob: Blob) {
    if (!user || !reserve("profile-update")) return;
    setSaving("photo");
    try {
      if (!blob.size || blob.type !== "image/webp") return toast.error(t.photoFailure);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return toast.error(t.photoFailure);
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const uploadFile = new File([blob], "foto-de-perfil.webp", { type: "image/webp" });
      const storage = supabase.storage.from(PROFILE_PHOTO_BUCKET);
      const { error: uploadError } = await storage.upload(path, uploadFile, { cacheControl: "3600", contentType: uploadFile.type, upsert: false });
      if (uploadError) return toast.error(t.photoFailure);
      const { error: profileError } = await supabase.auth.updateUser({ data: { avatar_path: path } });
      if (profileError) {
        await storage.remove([path]);
        return toast.error(t.photoFailure);
      }
      await refresh();
      setPendingPhoto(null);
      toast.success(t.photoSuccess);
    } finally {
      setSaving(null);
    }
  }

  async function removePhoto() {
    if (!user || !user.avatarPath || !reserve("profile-update")) return;
    setSaving("remove-photo");
    try {
      const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } });
      if (error) return toast.error(t.photoFailure);
      await refresh();
      toast.success(t.photoRemoved);
    } finally {
      setSaving(null);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!isPasswordValid(password)) return toast.error(t.passwordInvalid);
    if (password !== confirmation) return toast.error(t.passwordsMismatch);
    if (!reserve("password-update")) return;
    setSaving("password");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(null);
    if (error) return toast.error(t.passwordFailure);
    setPassword("");
    setConfirmation("");
    toast.success(t.passwordSuccess);
  }

  return <div className="account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-settings-title"><header className="account-dialog__header"><div><span className="account-dialog__eyebrow">EndoCare</span><h2 id="account-settings-title">{t.title}</h2></div><button type="button" className="account-dialog__close" aria-label={t.close} onClick={() => setOpen(false)}><X size={18} /></button></header><div className="account-dialog__body"><p>{t.intro}</p><section className="account-photo-card" aria-labelledby="account-photo-title"><div className="account-photo-card__intro"><ProfileAvatar name={currentUserName} avatarPath={user.avatarPath} size="large" /><div><strong id="account-photo-title">{t.photoTitle}</strong><small>{t.photoHint}</small></div></div><div className="account-photo-card__actions"><input ref={photoInputRef} type="file" accept={PROFILE_PHOTO_ACCEPT} onChange={handlePhotoSelected} hidden /><button className="account-primary" type="button" disabled={saving !== null} onClick={() => photoInputRef.current?.click()}>{saving === "photo" ? <LoaderCircle className="account-spinner" size={15} /> : <Camera size={15} />}{user.avatarPath ? t.changePhoto : t.choosePhoto}</button>{user.avatarPath ? <button className="account-photo-remove" type="button" disabled={saving !== null} onClick={() => void removePhoto()}>{saving === "remove-photo" ? <LoaderCircle className="account-spinner" size={15} /> : <Trash2 size={15} />}{t.removePhoto}</button> : null}</div></section>{pendingPhoto ? <ProfilePhotoEditor src={pendingPhoto.src} width={pendingPhoto.width} height={pendingPhoto.height} saving={saving === "photo"} copy={{ title: t.photoEditorTitle, helper: t.photoEditorHelper, zoom: t.photoEditorZoom, horizontal: t.photoEditorHorizontal, vertical: t.photoEditorVertical, cancel: t.photoEditorCancel, apply: t.photoEditorApply, preparing: t.photoEditorPreparing }} onCancel={() => setPendingPhoto(null)} onConfirm={(blob) => void saveCroppedPhoto(blob)} /> : null}<form className="account-form" onSubmit={saveName}><label><span><UserRound size={14} />{t.name}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" placeholder={t.namePlaceholder} required /></label><button className="account-primary" type="submit" disabled={saving !== null || !normalizedName || normalizedName === user.name}>{saving === "name" ? t.saving : <><Save size={15} />{t.saveName}</>}</button></form><form className="account-form account-form--password" onSubmit={savePassword}><div><strong>{t.passwordTitle}</strong><small>{t.passwordHint}</small></div><label><span><KeyRound size={14} />{t.password}</span><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required showLabel={t.showPassword} hideLabel={t.hidePassword} /></label><PasswordStrengthMeter password={password} /><label><span><LockKeyhole size={14} />{t.confirmPassword}</span><PasswordInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" required showLabel={t.showPassword} hideLabel={t.hidePassword} /></label><button className="account-primary" type="submit" disabled={saving !== null || !password || !confirmation}>{saving === "password" ? t.saving : <><ShieldCheck size={15} />{t.savePassword}</>}</button></form><p className="account-privacy"><ShieldCheck size={14} />{t.privacy}</p><button type="button" className="account-logout" onClick={() => void logout()}><LogOut size={15} />{t.logout}</button></div></section></div>;
}
