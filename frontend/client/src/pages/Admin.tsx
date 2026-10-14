import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AccountSettingsDialog } from "@/components/AccountSettingsDialog";
import { AdminChat } from "@/components/AdminChat";
import { EndoBotOwnerSupervision } from "@/components/EndoBotOwnerSupervision";
import QuestionnaireAdmin from "@/components/QuestionnaireAdmin";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { SiteCopyright } from "@/components/SiteCopyright";
import { Activity, ArrowLeft, Ban, BookOpenCheck, Check, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Eraser, FilePlus2, Hammer, Headphones, History, KeyRound, LockKeyhole, MessagesSquare, Pencil, Pin, PinOff, Power, RefreshCw, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, Timer, Trash2, UserRoundX, Users, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { accountActionsFor, canManageAccount, canManageAdministratorRole, canResetPunishmentReputation, needsAccountReason, punishmentReputation, staffCan, type AccountStatus, type AssignableStaffRole, type ManagedAccount, type StaffRole } from "@/lib/accountManagement";
import { reserveAuthAttempt } from "@/lib/authRateLimit";
import { isPasswordValid } from "@/lib/passwordPolicy";
import { moderationStatus, normalizeAdministrativeRole, type ModerationAction } from "@/lib/adminAccess";
import { loadSiteMonitoring as fetchSiteMonitoring, resetSiteMonitoring as resetSiteMonitoringData, type SiteMonitoringSnapshot } from "@/lib/siteMonitoring";
import { handleMessageComposerKeyDown } from "@/lib/messageComposer";
import { useSiteLanguage } from "@/contexts/SiteLanguageContext";
import "./Admin.css";
import "./AdminContentDeletion.css";
import "./AdminPasswordReset.css";
import "./AdminAccountControls.css";

const apiBase = import.meta.env.VITE_API_BASE_URL || "https://backendendoacolhe.vercel.app";

type ManagedStory = { id: string; author_alias: string; content: string; helpfulness: number; created_at: string; status: "pending" | "approved" | "rejected"; triage_status: "adequate" | "needs_review" | "likely_spam"; triage_confidence: number | null; triage_signals: string[] };
type ManagedPost = { id: string; category: string; title: string; summary: string; content: string; status: "draft" | "published"; published_at: string | null; updated_at: string; is_pinned: boolean };
type PostForm = { category: string; title: string; summary: string; content: string };
type AccountFilter = "all" | AccountStatus;
type AccountAction = { account: ManagedAccount; nextStatus: AccountStatus };
type ContentDeletionTarget = { kind: "story" | "post"; id: string; label: string };
type AccountDeletionTarget = ManagedAccount;
type ReputationResetTarget = ManagedAccount;
type QuestionnaireResetTarget = ManagedAccount;
type StaffRoleAction = { account: ManagedAccount; role: AssignableStaffRole | null };
type SupportThread = { id: string; requester_id: string; status: "open" | "resolved"; created_at: string; updated_at: string };
type SupportMessage = { id: string; sender_id: string | null; body: string; created_at: string };
type PunishmentLog = { id: string; actor_name: string | null; actor_email: string | null; target_name: string | null; target_email: string | null; previous_status: AccountStatus; next_status: AccountStatus; reason: string | null; created_at: string; expires_at: string | null };
type EndoBotSecurityEvent = { id: string; created_at: string; user_name: string | null; user_email: string | null; ip_fingerprint: string; signals: string[]; category?: "credential_access" | "prompt_injection" | "fault_injection" | "data_exfiltration" | "destructive_request" | "sensitive_disclosure"; severity?: "medium" | "high" | "critical"; risk_score?: number; source?: "input" | "output"; action: "blocked" | "ip_blocked" | "suspended"; expires_at: string | null; reviewed_at: string | null };

export const adminSectionOrder = ["admin-monitoring", "admin-questionnaire", "admin-users", "admin-punishments", "admin-endobot-supervision", "admin-endobot-security", "admin-chat", "admin-support", "admin-stories", "admin-posts"] as const;
export const deletableContentKinds = ["story", "post"] as const;
export function postWriteOperation(editingPostId: string | null) { return editingPostId ? "update" as const : "insert" as const; }
export function shouldRedirectFromAdmin(authLoading: boolean, checking: boolean, hasUser: boolean, authorized: boolean, authorizationError = false) { return !authLoading && !checking && !authorizationError && (!hasUser || !authorized); }

const endobotSecurityLabels = {
  pt: {
    categories: { credential_access: "Acesso a credencial", prompt_injection: "Prompt injection", fault_injection: "Injeção de falha", data_exfiltration: "Exfiltração de dados", destructive_request: "Pedido destrutivo", sensitive_disclosure: "Divulgação sensível" },
    severities: { medium: "Média", high: "Alta", critical: "Crítica" },
    sources: { input: "Entrada bloqueada", output: "Saída bloqueada" },
    signals: { credential_request: "Pedido de chave/credencial", instruction_override: "Substituição de instruções", prompt_disclosure: "Revelação de prompt", role_hijack: "Sequestro de papel", tool_execution: "Execução de ferramenta", fault_injection: "Fault injection", data_exfiltration: "Exfiltração", destructive_command: "Comando destrutivo", secret_material: "Material secreto", obfuscation: "Obfuscação", output_leakage: "Saída sensível" },
  },
  en: {
    categories: { credential_access: "Credential access", prompt_injection: "Prompt injection", fault_injection: "Fault injection", data_exfiltration: "Data exfiltration", destructive_request: "Destructive request", sensitive_disclosure: "Sensitive disclosure" },
    severities: { medium: "Medium", high: "High", critical: "Critical" },
    sources: { input: "Input blocked", output: "Output blocked" },
    signals: { credential_request: "Credential/key request", instruction_override: "Instruction override", prompt_disclosure: "Prompt disclosure", role_hijack: "Role hijack", tool_execution: "Tool execution", fault_injection: "Fault injection", data_exfiltration: "Data exfiltration", destructive_command: "Destructive command", secret_material: "Secret material", obfuscation: "Obfuscation", output_leakage: "Sensitive output" },
  },
  es: {
    categories: { credential_access: "Acceso a credenciales", prompt_injection: "Prompt injection", fault_injection: "Inyección de fallas", data_exfiltration: "Exfiltración de datos", destructive_request: "Solicitud destructiva", sensitive_disclosure: "Divulgación sensible" },
    severities: { medium: "Media", high: "Alta", critical: "Crítica" },
    sources: { input: "Entrada bloqueada", output: "Salida bloqueada" },
    signals: { credential_request: "Solicitud de clave/credencial", instruction_override: "Sustitución de instrucciones", prompt_disclosure: "Revelación del prompt", role_hijack: "Secuestro de rol", tool_execution: "Ejecución de herramienta", fault_injection: "Fault injection", data_exfiltration: "Exfiltración", destructive_command: "Comando destructivo", secret_material: "Material secreto", obfuscation: "Ofuscación", output_leakage: "Salida sensible" },
  },
} as const;

const contentDeletionCopy = {
  pt: { storiesTitle: "Relatos da comunidade", noStories: "Não há relatos para gerenciar.", delete: "Excluir", title: "Excluir conteúdo", story: "Este relato será apagado definitivamente. A ação e a conta administradora responsável ficarão registradas internamente.", post: "Este artigo será apagado definitivamente. A ação e a conta administradora responsável ficarão registradas internamente.", deleted: "Conteúdo excluído." },
  en: { storiesTitle: "Community stories", noStories: "There are no stories to manage.", delete: "Delete", title: "Delete content", story: "This story will be permanently deleted. The action and responsible administrator account will be logged internally.", post: "This article will be permanently deleted. The action and responsible administrator account will be logged internally.", deleted: "Content deleted." },
  es: { storiesTitle: "Relatos de la comunidad", noStories: "No hay relatos para gestionar.", delete: "Eliminar", title: "Eliminar contenido", story: "Este relato se eliminará definitivamente. La acción y la cuenta administradora responsable quedarán registradas internamente.", post: "Este artículo se eliminará definitivamente. La acción y la cuenta administradora responsable quedarán registradas internamente.", deleted: "Contenido eliminado." },
} as const;

const reportTriageCopy = {
  pt: { all: "Todos", adequate: "Sem sinal", needs_review: "Revisar", likely_spam: "Provável spam", intro: "A triagem automática só sinaliza suspeitas; a publicação continua dependendo da revisão humana." },
  en: { all: "All", adequate: "No signal", needs_review: "Review", likely_spam: "Likely spam", intro: "Automatic triage only flags concerns; publication still depends on human review." },
  es: { all: "Todos", adequate: "Sin señal", needs_review: "Revisar", likely_spam: "Probable spam", intro: "La triage automática solo señala sospechas; la publicación sigue dependiendo de la revisión humana." },
} as const;

const passwordResetCopy = {
  pt: { action: "Enviar link de redefinição", title: "Enviar link de redefinição", description: "A usuária receberá um link privado no e-mail cadastrado. Ela mesma escolherá a nova senha; a administração não verá nem armazenará senhas.", sent: "Link de redefinição de senha enviado.", failure: "Não foi possível enviar o link de redefinição agora.", wait: (seconds: number) => `Por segurança, aguarde cerca de ${seconds}s antes de enviar outro link.` },
  en: { action: "Send reset link", title: "Send password reset link", description: "The user will receive a private link at their registered email address. They choose the new password themselves; administrators never see or store passwords.", sent: "Password reset link sent.", failure: "Unable to send the password reset link right now.", wait: (seconds: number) => `For security, wait about ${seconds}s before sending another link.` },
  es: { action: "Enviar enlace de restablecimiento", title: "Enviar enlace para restablecer la contraseña", description: "La usuaria recibirá un enlace privado en su correo registrado. Ella misma elegirá la nueva contraseña; la administración no verá ni almacenará contraseñas.", sent: "Enlace para restablecer la contraseña enviado.", failure: "No fue posible enviar el enlace de restablecimiento ahora.", wait: (seconds: number) => `Por seguridad, espera aproximadamente ${seconds}s antes de enviar otro enlace.` },
} as const;

const directPasswordCopy = {
  pt: { action: "Definir nova senha", title: "Definir nova senha", description: "Use somente quando a pessoa precisar de suporte. A senha anterior não é exibida, e esta ação ficará registrada internamente.", password: "Nova senha temporária", confirmation: "Confirmar nova senha", saved: "Senha atualizada. Oriente a pessoa a trocá-la ao entrar.", failure: "Não foi possível atualizar a senha agora.", mismatch: "As senhas não coincidem.", invalid: "Revise todos os requisitos de segurança da senha.", showPassword: "Mostrar senha", hidePassword: "Ocultar senha" },
  en: { action: "Set new password", title: "Set new password", description: "Use this only when the person needs support. The previous password is never shown, and this action is recorded internally.", password: "New temporary password", confirmation: "Confirm new password", saved: "Password updated. Ask the person to change it after signing in.", failure: "Unable to update the password right now.", mismatch: "Passwords do not match.", invalid: "Review every password security requirement.", showPassword: "Show password", hidePassword: "Hide password" },
  es: { action: "Definir nueva contraseña", title: "Definir nueva contraseña", description: "Úsala solo cuando la persona necesite apoyo. La contraseña anterior nunca se muestra y esta acción queda registrada internamente.", password: "Nueva contraseña temporal", confirmation: "Confirmar nueva contraseña", saved: "Contraseña actualizada. Indica a la persona que la cambie al entrar.", failure: "No fue posible actualizar la contraseña ahora.", mismatch: "Las contraseñas no coinciden.", invalid: "Revisa todos los requisitos de seguridad de la contraseña.", showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña" },
} as const;

const accountControlCopy = {
  pt: { expiry: "Encerrar automaticamente em", expiryHint: "Defina a duração para que a pessoa saiba quando a medida terminará.", expiryInvalid: "Escolha uma data e horário futuros.", expiryAt: "Medida até", deleteAccount: "Excluir conta", deleteTitle: "Excluir conta definitivamente", deleteDescription: "Esta ação remove a conta, suas sessões e conteúdos vinculados. Não pode ser desfeita.", deletePrompt: "Digite EXCLUIR para confirmar", deleteConfirm: "Excluir conta", deleted: "Conta excluída.", deleteFailure: "Não foi possível excluir esta conta agora.", deleteKeyword: "EXCLUIR" },
  en: { expiry: "End automatically on", expiryHint: "Set a duration so the person knows when this measure will end.", expiryInvalid: "Choose a future date and time.", expiryAt: "Measure until", deleteAccount: "Delete account", deleteTitle: "Permanently delete account", deleteDescription: "This removes the account, its sessions, and linked content. It cannot be undone.", deletePrompt: "Type DELETE to confirm", deleteConfirm: "Delete account", deleted: "Account deleted.", deleteFailure: "This account could not be deleted now.", deleteKeyword: "DELETE" },
  es: { expiry: "Finalizar automáticamente el", expiryHint: "Define una duración para que la persona sepa cuándo terminará la medida.", expiryInvalid: "Elige una fecha y hora futuras.", expiryAt: "Medida hasta", deleteAccount: "Eliminar cuenta", deleteTitle: "Eliminar cuenta definitivamente", deleteDescription: "Esta acción elimina la cuenta, sus sesiones y contenidos vinculados. No se puede deshacer.", deletePrompt: "Escribe ELIMINAR para confirmar", deleteConfirm: "Eliminar cuenta", deleted: "Cuenta eliminada.", deleteFailure: "No fue posible eliminar esta cuenta ahora.", deleteKeyword: "ELIMINAR" },
} as const;

const reputationResetCopy = {
  pt: { action: "Restaurar reputação", title: "Restaurar reputação da conta", description: "Esta ação apaga definitivamente o histórico de punições usado para calcular a reputação. Ela não remove uma restrição ou suspensão que ainda esteja ativa.", prompt: "Digite RESTAURAR para confirmar", confirm: "Apagar histórico e restaurar", success: "Histórico de punições apagado e reputação restaurada.", failure: "Não foi possível restaurar a reputação desta conta agora.", keyword: "RESTAURAR" },
  en: { action: "Restore reputation", title: "Restore account reputation", description: "This permanently deletes the punishment history used to calculate reputation. It does not remove an active restriction or suspension.", prompt: "Type RESTORE to confirm", confirm: "Delete history and restore", success: "Punishment history deleted and reputation restored.", failure: "This account reputation could not be restored now.", keyword: "RESTORE" },
  es: { action: "Restaurar reputación", title: "Restaurar reputación de la cuenta", description: "Esta acción elimina definitivamente el historial de sanciones usado para calcular la reputación. No elimina una restricción o suspensión que aún esté activa.", prompt: "Escribe RESTAURAR para confirmar", confirm: "Eliminar historial y restaurar", success: "Historial de sanciones eliminado y reputación restaurada.", failure: "No fue posible restaurar la reputación de esta cuenta ahora.", keyword: "RESTAURAR" },
} as const;

const maintenanceCopy = {
  pt: { title: "Manutenção do site", on: "Site em manutenção", off: "Site em funcionamento", description: "A faixa amarela aparece no topo para avisar que algumas funções podem estar desabilitadas.", enable: "Ativar manutenção", disable: "Desativar manutenção", enabled: "Modo de manutenção ativado.", disabled: "Modo de manutenção desativado.", failure: "Não foi possível atualizar o modo de manutenção agora.", saving: "Salvando…" },
  en: { title: "Site maintenance", on: "Site in maintenance", off: "Site operational", description: "The yellow banner appears at the top to let people know some features may be disabled.", enable: "Enable maintenance", disable: "Disable maintenance", enabled: "Maintenance mode enabled.", disabled: "Maintenance mode disabled.", failure: "Maintenance mode could not be updated right now.", saving: "Saving…" },
  es: { title: "Mantenimiento del sitio", on: "Sitio en mantenimiento", off: "Sitio funcionando", description: "La franja amarilla aparece arriba para avisar que algunas funciones pueden estar deshabilitadas.", enable: "Activar mantenimiento", disable: "Desactivar mantenimiento", enabled: "Modo de mantenimiento activado.", disabled: "Modo de mantenimiento desactivado.", failure: "No fue posible actualizar el modo de mantenimiento ahora.", saving: "Guardando…" },
} as const;

const supportCopy = {
  pt: { title: "Atendimentos de conta", intro: "Mensagens privadas enviadas por pessoas restritas ou suspensas aparecem aqui sem recarregar a página.", empty: "Nenhuma conversa de suporte aberta.", select: "Selecione um atendimento para responder.", placeholder: "Escreva uma resposta objetiva…", send: "Responder", sending: "Enviando…", failure: "Não foi possível enviar a resposta agora.", user: "Pessoa usuária", administration: "Administração", open: "Em aberto" },
  en: { title: "Account support", intro: "Private messages sent by restricted or suspended people appear here without a page refresh.", empty: "No open support conversations.", select: "Choose a conversation to reply.", placeholder: "Write an objective response…", send: "Reply", sending: "Sending…", failure: "The response could not be sent right now.", user: "User", administration: "Administration", open: "Open" },
  es: { title: "Atenciones de cuenta", intro: "Los mensajes privados enviados por personas restringidas o suspendidas aparecen aquí sin recargar la página.", empty: "No hay conversaciones de soporte abiertas.", select: "Selecciona una conversación para responder.", placeholder: "Escribe una respuesta objetiva…", send: "Responder", sending: "Enviando…", failure: "No fue posible enviar la respuesta ahora.", user: "Persona usuaria", administration: "Administración", open: "Abierto" },
} as const;

const administratorRoleCopy = {
  pt: { owner: "Dono", ownerNote: "Você é o Dono desta plataforma. Somente sua conta pode conceder ou remover o acesso administrativo.", grant: "Definir cargo", revoke: "Remover cargo", grantTitle: "Definir cargo administrativo", revokeTitle: "Remover cargo administrativo", grantDescription: "Escolha se a pessoa será Suporte, Moderador ou Admin. A alteração ficará registrada internamente.", revokeDescription: "Esta pessoa deixará de acessar a área administrativa. A alteração ficará registrada internamente.", confirmGrant: "Confirmar cargo", confirmRevoke: "Remover cargo", updated: "Cargo administrativo atualizado.", failure: "Não foi possível atualizar o cargo administrativo agora.", roles: { support: "Suporte", moderator: "Moderador", admin: "Admin", none: "Sem cargo" } },
  en: { owner: "Owner", ownerNote: "You are the owner of this platform. Only your account can grant or remove administrative access.", grant: "Set role", revoke: "Remove role", grantTitle: "Set staff role", revokeTitle: "Remove staff role", grantDescription: "Choose whether the person will be Support, Moderator, or Admin. The change will be logged internally.", revokeDescription: "This person will no longer access the administration area. The change will be logged internally.", confirmGrant: "Confirm role", confirmRevoke: "Remove role", updated: "Staff role updated.", failure: "The staff role cannot be updated right now.", roles: { support: "Support", moderator: "Moderator", admin: "Admin", none: "No staff role" } },
  es: { owner: "Dueño", ownerNote: "Eres el dueño de esta plataforma. Solo tu cuenta puede conceder o retirar el acceso administrativo.", grant: "Definir cargo", revoke: "Quitar cargo", grantTitle: "Definir cargo de equipo", revokeTitle: "Quitar cargo de equipo", grantDescription: "Elige si la persona será Soporte, Moderador o Admin. El cambio quedará registrado internamente.", revokeDescription: "Esta persona dejará de acceder al área administrativa. El cambio quedará registrado internamente.", confirmGrant: "Confirmar cargo", confirmRevoke: "Quitar cargo", updated: "Rol de equipo actualizado.", failure: "No fue posible actualizar el rol de equipo ahora.", roles: { support: "Soporte", moderator: "Moderador", admin: "Admin", none: "Sin cargo" } },
} as const;

const emptyPostForm: PostForm = { category: "", title: "", summary: "", content: "" };

const adminCopy = {
  pt: {
    eyebrow: "Área protegida", title: "Moderação e contas", intro: "Revise conteúdos, publique artigos e aplique medidas de conta reversíveis, registradas e restritas à administração.", signIn: "Entrar para continuar", denied: "Acesso restrito", deniedText: "Sua conta não está na lista de administradores permitidos.", checking: "Verificando acesso…", pending: "Relatos pendentes", empty: "Não há relatos aguardando revisão.", refresh: "Atualizar", approve: "Aprovar", reject: "Rejeitar", saved: "Moderação salva.", failure: "Não foi possível concluir esta ação agora.", signedOut: "É necessário entrar para acessar a administração.", private: "O acesso é verificado por políticas protegidas do banco de dados.", postTitle: "Publicar novo artigo", postIntro: "Somente administradoras podem salvar rascunhos ou publicar artigos. A leitura pública exibe somente artigos publicados.", category: "Categoria", postName: "Título do artigo", summary: "Resumo breve", content: "Artigo completo", categoryHint: "Ex.: Leitura guiada", titleHint: "Título claro e informativo", summaryHint: "Uma síntese para quem vai ler", contentHint: "Escreva o artigo educativo aqui. Evite prescrição ou recomendações de tratamento.", saveDraft: "Salvar rascunho", publish: "Publicar artigo", required: "Preencha categoria, título, resumo e conteúdo antes de salvar.", postSaved: "Artigo salvo.", recentPosts: "Artigos recentes", noPosts: "Ainda não há artigos criados.", draft: "Rascunho", published: "Publicado", accountsTitle: "Gerenciar contas", accountsIntro: "Restrinja ou suspenda contas somente quando necessário. Todas as ações são reversíveis e ficam registradas internamente.", searchAccounts: "Buscar por nome ou e-mail", search: "Buscar", all: "Todas", active: "Ativa", restricted: "Restrita", suspended: "Suspensa", noAccounts: "Nenhuma conta corresponde aos filtros atuais.", protectedAccount: "Protegida", accountReason: "Motivo interno", noReason: "Sem medida ativa", accountSince: "Conta criada em", actionRestricted: "Restringir", actionSuspended: "Suspender", actionRestore: "Restaurar acesso", confirmTitle: "Confirmar mudança de conta", confirmRestriction: "A conta continuará existindo, mas não poderá enviar novos relatos nem salvar novas conversas. Informe o motivo interno.", confirmSuspension: "A conta continuará existindo, mas ficará sem acesso às ações protegidas do EndoCare até restauração. Informe o motivo interno.", confirmRestore: "A restauração remove a medida atual e preserva o registro interno da ação anterior.", reasonPlaceholder: "Descreva o motivo de forma objetiva (3 a 300 caracteres).", reasonRequired: "Informe um motivo entre 3 e 300 caracteres.", cancel: "Cancelar", confirm: "Confirmar ação", accountUpdated: "Status da conta atualizado.", currentAdmin: "Sua conta", accountActionLocked: "Contas administrativas são gerenciadas fora deste painel.", auditNote: "As contas não são apagadas por este painel; suspensão, restrição e restauração geram trilha de auditoria.", statusFilter: "Filtrar por status", accountCount: "contas", questionnaireReset: "Liberar questionário", questionnaireResetTitle: "Liberar novo questionário", questionnaireResetDescription: "Isso permite que esta conta envie uma nova resposta agora. O histórico anterior não será apagado e o reset ficará registrado.", questionnaireResetConfirm: "Liberar envio", questionnaireResetSuccess: "Limite do questionário liberado.", questionnaireResetFailure: "Não foi possível liberar o questionário agora.", questionnaireResetting: "Liberando…" },
  en: {
    eyebrow: "Protected area", title: "Moderation and accounts", intro: "Review content, publish articles, and apply reversible account measures restricted to administrators.", signIn: "Sign in to continue", denied: "Access restricted", deniedText: "Your account is not on the permitted administrators list.", checking: "Checking access…", pending: "Pending stories", empty: "There are no stories awaiting review.", refresh: "Refresh", approve: "Approve", reject: "Reject", saved: "Moderation saved.", failure: "This action cannot be completed right now.", signedOut: "You need to sign in to access the administration area.", private: "Access is checked by protected database policies.", postTitle: "Publish a new article", postIntro: "Only administrators can save drafts or publish articles. Public readers see published articles only.", category: "Category", postName: "Article title", summary: "Short summary", content: "Full article", categoryHint: "E.g.: Guided reading", titleHint: "Clear, informative title", summaryHint: "A concise overview for readers", contentHint: "Write the educational article here. Avoid prescription or treatment recommendations.", saveDraft: "Save draft", publish: "Publish article", required: "Complete category, title, summary, and content before saving.", postSaved: "Article saved.", recentPosts: "Recent articles", noPosts: "No articles have been created yet.", draft: "Draft", published: "Published", accountsTitle: "Manage accounts", accountsIntro: "Restrict or suspend accounts only when necessary. Every action is reversible and logged internally.", searchAccounts: "Search by name or email", search: "Search", all: "All", active: "Active", restricted: "Restricted", suspended: "Suspended", noAccounts: "No accounts match the current filters.", protectedAccount: "Protected", accountReason: "Internal reason", noReason: "No active measure", accountSince: "Account created", actionRestricted: "Restrict", actionSuspended: "Suspend", actionRestore: "Restore access", confirmTitle: "Confirm account change", confirmRestriction: "The account will remain, but cannot submit new stories or save new conversations. Provide an internal reason.", confirmSuspension: "The account will remain, but will lose access to protected EndoCare actions until restored. Provide an internal reason.", confirmRestore: "Restoration removes the current measure while preserving the internal record of the previous action.", reasonPlaceholder: "Describe the reason objectively (3 to 300 characters).", reasonRequired: "Provide a reason between 3 and 300 characters.", cancel: "Cancel", confirm: "Confirm action", accountUpdated: "Account status updated.", currentAdmin: "Your account", accountActionLocked: "Administrator accounts are managed outside this panel.", auditNote: "This panel never deletes accounts; suspension, restriction and restoration create an audit trail.", statusFilter: "Filter by status", accountCount: "accounts", questionnaireReset: "Release questionnaire", questionnaireResetTitle: "Release a new questionnaire submission", questionnaireResetDescription: "This lets the account send a new response now. Previous history is not deleted, and the reset is recorded.", questionnaireResetConfirm: "Release submission", questionnaireResetSuccess: "Questionnaire limit released.", questionnaireResetFailure: "The questionnaire could not be released right now.", questionnaireResetting: "Releasing…" },
  es: {
    eyebrow: "Área protegida", title: "Moderación y cuentas", intro: "Revisa contenido, publica artículos y aplica medidas de cuenta reversibles restringidas a la administración.", signIn: "Entrar para continuar", denied: "Acceso restringido", deniedText: "Tu cuenta no está en la lista de administradores permitidos.", checking: "Verificando acceso…", pending: "Relatos pendientes", empty: "No hay relatos esperando revisión.", refresh: "Actualizar", approve: "Aprobar", reject: "Rechazar", saved: "Moderación guardada.", failure: "No es posible completar esta acción ahora.", signedOut: "Debes iniciar sesión para acceder al área de administración.", private: "El acceso se verifica mediante políticas protegidas de la base de datos.", postTitle: "Publicar un nuevo artículo", postIntro: "Solo las personas administradoras pueden guardar borradores o publicar artículos. El público ve únicamente artículos publicados.", category: "Categoría", postName: "Título del artículo", summary: "Resumen breve", content: "Artículo completo", categoryHint: "Ej.: Lectura guiada", titleHint: "Título claro e informativo", summaryHint: "Una síntesis para quien lee", contentHint: "Escribe el artículo educativo aquí. Evita prescripciones o recomendaciones de tratamiento.", saveDraft: "Guardar borrador", publish: "Publicar artículo", required: "Completa la categoría, el resumen y el contenido antes de guardar.", postSaved: "Artículo guardado.", recentPosts: "Artículos recientes", noPosts: "Aún no se han creado artículos.", draft: "Borrador", published: "Publicado", accountsTitle: "Gestionar cuentas", accountsIntro: "Restringe o suspende cuentas solo cuando sea necesario. Cada acción es reversible y queda registrada internamente.", searchAccounts: "Buscar por nombre o correo", search: "Buscar", all: "Todas", active: "Activa", restricted: "Restringida", suspended: "Suspendida", noAccounts: "Ninguna cuenta coincide con los filtros actuales.", protectedAccount: "Protegida", accountReason: "Motivo interno", noReason: "Sin medida activa", accountSince: "Cuenta creada", actionRestricted: "Restringir", actionSuspended: "Suspender", actionRestore: "Restaurar acceso", confirmTitle: "Confirmar cambio de cuenta", confirmRestriction: "La cuenta seguirá existiendo, pero no podrá enviar relatos nuevos ni guardar conversaciones nuevas. Indica el motivo interno.", confirmSuspension: "La cuenta seguirá existiendo, pero perderá acceso a las acciones protegidas de EndoCare hasta que se restaure. Indica el motivo interno.", confirmRestore: "La restauración elimina la medida actual y conserva el registro interno de la acción anterior.", reasonPlaceholder: "Describe el motivo de forma objetiva (3 a 300 caracteres).", reasonRequired: "Indica un motivo entre 3 y 300 caracteres.", cancel: "Cancelar", confirm: "Confirmar acción", accountUpdated: "Estado de la cuenta actualizado.", currentAdmin: "Tu cuenta", accountActionLocked: "Las cuentas administrativas se gestionan fuera de este panel.", auditNote: "Este panel nunca elimina cuentas; suspensión, restricción y restauración crean una auditoría.", statusFilter: "Filtrar por estado", accountCount: "cuentas", questionnaireReset: "Liberar cuestionario", questionnaireResetTitle: "Liberar un nuevo envío del cuestionario", questionnaireResetDescription: "Esto permite que la cuenta envíe una nueva respuesta ahora. El historial anterior no se elimina y el restablecimiento queda registrado.", questionnaireResetConfirm: "Liberar envío", questionnaireResetSuccess: "Límite del cuestionario liberado.", questionnaireResetFailure: "No fue posible liberar el cuestionario ahora.", questionnaireResetting: "Liberando…" },
} as const;

type AdminCopy = (typeof adminCopy)[keyof typeof adminCopy];

function statusLabel(status: AccountStatus, copy: AdminCopy) {
  return status === "active" ? copy.active : status === "restricted" ? copy.restricted : copy.suspended;
}

function actionLabel(status: AccountStatus, copy: AdminCopy) {
  return status === "active" ? copy.actionRestore : status === "restricted" ? copy.actionRestricted : copy.actionSuspended;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const redirectingRef = useRef(false);
  const { language, locale } = useSiteLanguage();
  const copy = adminCopy[language];
  const deletionCopy = contentDeletionCopy[language];
  const triageText = reportTriageCopy[language];
  const passwordCopy = passwordResetCopy[language];
  const directCopy = directPasswordCopy[language];
  const controlCopy = accountControlCopy[language];
  const reputationCopy = reputationResetCopy[language];
  const roleCopy = administratorRoleCopy[language];
  const supportText = supportCopy[language];
  const maintenanceText = maintenanceCopy[language];
  const securityText = language === "en" ? { title: "EndoBot security", intro: "Automatic events cover credential requests, prompt injection, fault injection, destructive requests and sensitive output, without storing chat text or a raw IP address. Only the Owner can review these records.", empty: "No suspicious EndoBot activity recorded.", reviewed: "Reviewed", review: "Mark as reviewed", clear: "Review and clear IP block", byNetwork: "Protected network fingerprint", noAccount: "Anonymous session", blocked: "Message blocked", ipBlocked: "Network blocked", suspended: "Account suspended", updated: "Security event reviewed." } : language === "es" ? { title: "Seguridad del EndoBot", intro: "Los eventos automáticos cubren solicitudes de credenciales, prompt injection, inyección de fallas, solicitudes destructivas y salidas sensibles, sin guardar texto del chat ni direcciones IP sin protección. Solo el Dueño puede revisar estos registros.", empty: "No hay actividad sospechosa registrada en EndoBot.", reviewed: "Revisado", review: "Marcar como revisado", clear: "Revisar y liberar bloqueo de IP", byNetwork: "Huella protegida de red", noAccount: "Sesión anónima", blocked: "Mensaje bloqueado", ipBlocked: "Red bloqueada", suspended: "Cuenta suspendida", updated: "Evento de seguridad revisado." } : { title: "Segurança do EndoBot", intro: "Os eventos automáticos cobrem pedidos de credenciais, prompt injection, fault injection, pedidos destrutivos e saídas sensíveis, sem guardar o texto do chat nem o IP em claro. Somente o Dono pode revisar estes registros.", empty: "Nenhuma atividade suspeita do EndoBot foi registrada.", reviewed: "Revisado", review: "Marcar como revisado", clear: "Revisar e liberar bloqueio de IP", byNetwork: "Impressão protegida da rede", noAccount: "Sessão anônima", blocked: "Mensagem bloqueada", ipBlocked: "Rede bloqueada", suspended: "Conta suspensa", updated: "Evento de segurança revisado." };
  const securityLabels = endobotSecurityLabels[language];
  const monitoringText = language === "en" ? { title: "Site monitoring", intro: "Aggregated traffic, engagement and technical events. No passwords, messages, story text or raw IP addresses are recorded.", sevenDays: "7 days", thirtyDays: "30 days", views: "Page views", sessions: "Sessions", engaged: "Engaged sessions", errors: "Technical errors", admin: "Admin actions", trend: "Traffic and engagement", routes: "Top routes", noData: "Monitoring is ready. Data will appear as people use the site.", loading: "Loading metrics…", viewsShort: "Views", sessionsShort: "Sessions", engagedShort: "Engaged", errorsShort: "Errors", controls: "Account controls", deletions: "Content deletions", passwords: "Password actions", roles: "Role changes", resetAction: "Reset metrics", resetTitle: "Reset site metrics?", resetDescription: "Page views, sessions, engagement and navigation errors will be permanently deleted. Administrative actions remain in the audit history.", resetConfirm: "Reset metrics", resetting: "Resetting…", resetDone: "Site metrics reset." } : language === "es" ? { title: "Monitoreo del sitio", intro: "Tráfico, interacción y eventos técnicos agregados. No se registran contraseñas, mensajes, textos de relatos ni IP sin protección.", sevenDays: "7 días", thirtyDays: "30 días", views: "Vistas de página", sessions: "Sesiones", engaged: "Sesiones con interacción", errors: "Errores técnicos", admin: "Acciones administrativas", trend: "Tráfico e interacción", routes: "Rutas principales", noData: "El monitoreo está listo. Los datos aparecerán a medida que las personas usen el sitio.", loading: "Cargando métricas…", viewsShort: "Vistas", sessionsShort: "Sesiones", engagedShort: "Interacción", errorsShort: "Errores", controls: "Controles de cuenta", deletions: "Eliminaciones de contenido", passwords: "Acciones de contraseña", roles: "Cambios de cargo", resetAction: "Restablecer métricas", resetTitle: "¿Restablecer las métricas del sitio?", resetDescription: "Las vistas, sesiones, interacción y errores de navegación se eliminarán definitivamente. Las acciones administrativas permanecen en el historial de auditoría.", resetConfirm: "Restablecer métricas", resetting: "Restableciendo…", resetDone: "Métricas del sitio restablecidas." } : { title: "Monitoramento do site", intro: "Acessos, engajamento e eventos técnicos agregados. Não registramos senhas, mensagens, textos de relatos ou IPs em claro.", sevenDays: "7 dias", thirtyDays: "30 dias", views: "Visualizações", sessions: "Sessões", engaged: "Sessões engajadas", errors: "Erros técnicos", admin: "Ações administrativas", trend: "Acessos e engajamento", routes: "Rotas mais acessadas", noData: "O monitoramento está pronto. Os dados aparecerão conforme as pessoas usarem o site.", loading: "Carregando métricas…", viewsShort: "Visualizações", sessionsShort: "Sessões", engagedShort: "Engajadas", errorsShort: "Erros", controls: "Controles de conta", deletions: "Exclusões de conteúdo", passwords: "Ações de senha", roles: "Mudanças de cargo", resetAction: "Resetar métricas", resetTitle: "Resetar métricas do site?", resetDescription: "As visualizações, sessões, engajamento e erros de navegação serão apagados definitivamente. As ações administrativas permanecem no histórico de auditoria.", resetConfirm: "Resetar métricas", resetting: "Resetando…", resetDone: "Métricas do site resetadas." };
  const questionnaireNavText = language === "en" ? "Questionnaire" : language === "es" ? "Cuestionario" : "Questionário";
  const postEditorText = language === "en" ? { edit: "Edit", editing: "Edit article", cancel: "Cancel edit", saveDraft: "Update draft", publish: "Update article", updated: "Article updated." } : language === "es" ? { edit: "Editar", editing: "Editar artículo", cancel: "Cancelar edición", saveDraft: "Actualizar borrador", publish: "Actualizar artículo", updated: "Artículo actualizado." } : { edit: "Editar", editing: "Editar artigo", cancel: "Cancelar edição", saveDraft: "Atualizar rascunho", publish: "Atualizar artigo", updated: "Artigo atualizado." };
  const postPinText = language === "en" ? { pin: "Pin to top", unpin: "Unpin from top", pinned: "Pinned", saved: "Article priority updated." } : language === "es" ? { pin: "Fijar arriba", unpin: "Quitar de arriba", pinned: "Fijado", saved: "Prioridad del artículo actualizada." } : { pin: "Fixar no topo", unpin: "Desafixar do topo", pinned: "Fixado", saved: "Prioridade do artigo atualizada." };
  const roleLabels = { owner: roleCopy.owner, ...roleCopy.roles };
  const reputationLabels = language === "en" ? { good: "Good · no punishments", attention: "Attention · some punishments", "very-poor": "Very poor · repeated punishments" } : language === "es" ? { good: "Buena · sin sanciones", attention: "Atención · algunas sanciones", "very-poor": "Muy mala · sanciones repetidas" } : { good: "Boa · sem punições", attention: "Atenção · algumas punições", "very-poor": "Muito ruim · várias punições" };
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [authorizationError, setAuthorizationError] = useState(false);
  const [adminGateUnlocked, setAdminGateUnlocked] = useState(false);
  const [adminGatePassword, setAdminGatePassword] = useState("");
  const [adminGateError, setAdminGateError] = useState("");
  const [adminGateLoading, setAdminGateLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState<StaffRole | null>(null);
  const [stories, setStories] = useState<ManagedStory[]>([]);
  const [storyTriageFilter, setStoryTriageFilter] = useState<"all" | "needs_review" | "likely_spam" | "adequate">("all");
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [postForm, setPostForm] = useState<PostForm>(emptyPostForm);
  const [editingPost, setEditingPost] = useState<ManagedPost | null>(null);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState<"draft" | "published" | null>(null);
  const [pinningPostId, setPinningPostId] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const [accountReason, setAccountReason] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountExpiresAt, setAccountExpiresAt] = useState("");
  const [passwordResetAccount, setPasswordResetAccount] = useState<ManagedAccount | null>(null);
  const [passwordResetting, setPasswordResetting] = useState(false);
  const [directPasswordAccount, setDirectPasswordAccount] = useState<ManagedAccount | null>(null);
  const [directPassword, setDirectPassword] = useState("");
  const [directPasswordConfirmation, setDirectPasswordConfirmation] = useState("");
  const [directPasswordSaving, setDirectPasswordSaving] = useState(false);
  const [contentDeletion, setContentDeletion] = useState<ContentDeletionTarget | null>(null);
  const [deletingContent, setDeletingContent] = useState(false);
  const [accountDeletion, setAccountDeletion] = useState<AccountDeletionTarget | null>(null);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [reputationResetAccount, setReputationResetAccount] = useState<ReputationResetTarget | null>(null);
  const [reputationResetConfirmation, setReputationResetConfirmation] = useState("");
  const [resettingReputation, setResettingReputation] = useState(false);
  const [questionnaireResetAccount, setQuestionnaireResetAccount] = useState<QuestionnaireResetTarget | null>(null);
  const [questionnaireResetting, setQuestionnaireResetting] = useState(false);
  const [staffRoleAction, setStaffRoleAction] = useState<StaffRoleAction | null>(null);
  const [administratorRoleSaving, setAdministratorRoleSaving] = useState(false);
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [selectedSupportThread, setSelectedSupportThread] = useState<SupportThread | null>(null);
  const selectedSupportThreadIdRef = useRef<string | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportDraft, setSupportDraft] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [punishmentLogs, setPunishmentLogs] = useState<PunishmentLog[]>([]);
  const [endoBotSecurityEvents, setEndoBotSecurityEvents] = useState<EndoBotSecurityEvent[]>([]);
  const [reviewingSecurityEventId, setReviewingSecurityEventId] = useState<string | null>(null);
  const [siteMonitoring, setSiteMonitoring] = useState<SiteMonitoringSnapshot | null>(null);
  const [monitoringDays, setMonitoringDays] = useState<7 | 30>(7);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringResetOpen, setMonitoringResetOpen] = useState(false);
  const [monitoringResetting, setMonitoringResetting] = useState(false);
  const accessErrorCopy = language === "en" ? { title: "Access check unavailable", text: "We could not validate your administrative access right now. No protected data was loaded. Try again in a moment.", retry: "Try again" } : language === "es" ? { title: "No fue posible verificar el acceso", text: "No pudimos validar tu acceso administrativo ahora. No se cargaron datos protegidos. Inténtalo de nuevo en un momento.", retry: "Intentar de nuevo" } : { title: "Não foi possível verificar o acesso", text: "Não conseguimos validar seu acesso administrativo agora. Nenhum dado protegido foi carregado. Tente novamente em instantes.", retry: "Tentar novamente" };
  const pendingStoriesCount = useMemo(() => stories.filter((story) => story.status === "pending").length, [stories]);
  const canViewUsers = staffCan(currentRole, "viewUsers");
  const canApplyPunishments = staffCan(currentRole, "applyPunishments");
  const canModerateStories = staffCan(currentRole, "moderateStories");
  const canManageContent = staffCan(currentRole, "manageContent");
  const canManageBlog = staffCan(currentRole, "manageBlog");
  const canSupportChat = staffCan(currentRole, "supportChat");
  const canViewPunishmentLogs = staffCan(currentRole, "viewPunishmentLogs");
  const canDeleteAccounts = staffCan(currentRole, "deleteAccounts");
  const canSendPasswordReset = staffCan(currentRole, "sendPasswordReset");
  const canResetPasswordDirectly = staffCan(currentRole, "resetPasswordDirectly");
  const canManageRoles = staffCan(currentRole, "manageRoles");
  const canManageQuestionnaire = staffCan(currentRole, "manageQuestionnaire");
  const canViewQuestionnaireResults = staffCan(currentRole, "viewQuestionnaireResults");

  const actionDescription = useMemo(() => {
    if (!accountAction) return "";
    return accountAction.nextStatus === "restricted" ? copy.confirmRestriction : accountAction.nextStatus === "suspended" ? copy.confirmSuspension : copy.confirmRestore;
  }, [accountAction, copy]);

  const loadAccounts = async () => {
    if (!user) return;
    setAccountsLoading(true);
    const { data, error } = await supabase.rpc("list_endoacolhe_accounts", { p_search: accountSearch.trim() || null, p_status: accountFilter });
    if (error) setNotice(copy.failure); else setAccounts((data ?? []) as ManagedAccount[]);
    setAccountsLoading(false);
  };

  const loadMaintenanceStatus = async () => {
    const { data, error } = await supabase.rpc("get_endoacolhe_maintenance_status");
    if (!error && typeof data === "boolean") setMaintenanceEnabled(data);
  };
  async function refreshAdminWorkspace(role: StaffRole) {
    const [storiesResult, postsResult] = await Promise.all([
      staffCan(role, "moderateStories") ? supabase.from("community_stories").select("id,author_alias,content,helpfulness,created_at,status,triage_status,triage_confidence,triage_signals").order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      staffCan(role, "manageBlog") ? supabase.from("blog_posts").select("id,category,title,summary,content,status,published_at,updated_at,is_pinned").order("updated_at", { ascending: false }).limit(12) : Promise.resolve({ data: [], error: null }),
    ]);
    if (storiesResult.error || postsResult.error) setNotice(copy.failure); else { setStories((storiesResult.data ?? []) as ManagedStory[]); setPosts((postsResult.data ?? []) as ManagedPost[]); }
    if (staffCan(role, "viewUsers")) await loadAccounts(); else setAccounts([]);
    if (staffCan(role, "supportChat")) await loadSupportThreads(); else setSupportThreads([]);
    if (staffCan(role, "viewPunishmentLogs")) await loadPunishmentLogs(); else setPunishmentLogs([]);
    if (role === "owner") await Promise.all([loadEndoBotSecurityEvents(), loadSiteMonitoring(), loadMaintenanceStatus()]); else { setEndoBotSecurityEvents([]); setSiteMonitoring(null); setMaintenanceEnabled(true); }
  }

  const load = async () => {
    setAuthorizationError(false);
    if (!user) { setAuthorized(false); setAdminGateUnlocked(false); setIsOwner(false); setCurrentRole(null); setChecking(false); return; }
    setChecking(true); setNotice("");
    let roleData: unknown = null;
    let roleError: { message?: string } | null = null;
    let gateOpen: boolean | null = null;
    let gateError: { message?: string } | null = null;
    try {
      const [roleResult, gateResult] = await Promise.all([
        supabase.rpc("current_endoacolhe_admin_role"),
        supabase.rpc("has_endoacolhe_admin_access"),
      ]);
      roleData = roleResult.data;
      roleError = roleResult.error;
      gateOpen = gateResult.data;
      gateError = gateResult.error;
    } catch {
      setAuthorizationError(true); setAuthorized(false); setAdminGateUnlocked(false); setIsOwner(false); setCurrentRole(null); setChecking(false); return;
    }
    if (roleError) { setAuthorizationError(true); setAuthorized(false); setAdminGateUnlocked(false); setIsOwner(false); setCurrentRole(null); setChecking(false); return; }
    const role = normalizeAdministrativeRole(roleData) as StaffRole | null;
    if (!role) { setAuthorized(false); setAdminGateUnlocked(false); setIsOwner(false); setCurrentRole(null); setChecking(false); return; }
    setCurrentRole(role); setIsOwner(role === "owner"); setAuthorized(true);
    if (gateError || !gateOpen) { setAdminGateUnlocked(false); setChecking(false); return; }
    setAdminGateUnlocked(true);
    await refreshAdminWorkspace(role);
    setChecking(false);
  };

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!shouldRedirectFromAdmin(authLoading, checking, Boolean(user), authorized, authorizationError) || redirectingRef.current) return;
    redirectingRef.current = true;
    window.location.replace("/");
  }, [authLoading, authorized, authorizationError, checking, user?.id]);

  async function unlockAdminAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = adminGatePassword;
    if (!password || adminGateLoading) return;
    const limit = reserveAuthAttempt("admin-access-gate");
    if (!limit.allowed) { setAdminGateError(language === "en" ? `For security, wait about ${limit.retryAfterSeconds}s before trying again.` : language === "es" ? `Por seguridad, espera aproximadamente ${limit.retryAfterSeconds}s antes de intentarlo de nuevo.` : `Por segurança, aguarde cerca de ${limit.retryAfterSeconds}s antes de tentar novamente.`); return; }
    setAdminGateLoading(true);
    setAdminGateError("");
    const { data, error } = await supabase.rpc("unlock_endoacolhe_admin_access", { p_password: password });
    setAdminGatePassword("");
    setAdminGateLoading(false);
    if (error || !data) { setAdminGateError(language === "en" ? "The additional access password is incorrect. Review it and try again." : language === "es" ? "La contraseña adicional de acceso es incorrecta. Revísala e inténtalo de nuevo." : "A senha adicional de acesso está incorreta. Revise-a e tente novamente."); return; }
    await load();
  }

  useEffect(() => {
    if (!user || !authorized || !adminGateUnlocked || !currentRole) return;
    const channel = supabase
      .channel("admin-live-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "admin_realtime_signal" }, () => void refreshAdminWorkspace(currentRole))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [accountFilter, accountSearch, adminGateUnlocked, authorized, currentRole, language, user?.id]);

  async function loadSupportThreads() {
    const { data, error } = await supabase.from("account_support_threads").select("id,requester_id,status,created_at,updated_at").eq("status", "open").order("updated_at", { ascending: false }).limit(50);
    if (error) return;
    const threads = (data ?? []) as SupportThread[];
    setSupportThreads(threads);
    setSelectedSupportThread((current) => current && threads.some((thread) => thread.id === current.id) ? current : threads[0] ?? null);
  }

  async function loadPunishmentLogs() {
    const { data, error } = await supabase.rpc("list_endoacolhe_punishment_log");
    if (!error) setPunishmentLogs((data ?? []) as PunishmentLog[]);
  }

  async function loadEndoBotSecurityEvents() {
    const { data, error } = await supabase.rpc("list_endoacolhe_endobot_security_events");
    if (!error) setEndoBotSecurityEvents((data ?? []) as EndoBotSecurityEvent[]);
  }

  async function loadSiteMonitoring(days = monitoringDays) {
    setMonitoringLoading(true);
    try { setSiteMonitoring(await fetchSiteMonitoring(days)); } catch { setNotice(copy.failure); }
    setMonitoringLoading(false);
  }

  async function changeMonitoringDays(days: 7 | 30) {
    setMonitoringDays(days);
    await loadSiteMonitoring(days);
  }

  async function resetMonitoring() {
    if (!isOwner || monitoringResetting) return;
    setMonitoringResetting(true);
    try {
      await resetSiteMonitoringData();
      setMonitoringResetOpen(false);
      setNotice(monitoringText.resetDone);
      await loadSiteMonitoring(monitoringDays);
    } catch {
      setNotice(copy.failure);
    } finally {
      setMonitoringResetting(false);
    }
  }

  async function reviewEndoBotSecurityEvent(event: EndoBotSecurityEvent, clearIpBlock: boolean) {
    if (reviewingSecurityEventId) return;
    setReviewingSecurityEventId(event.id);
    const { error } = await supabase.rpc("review_endoacolhe_endobot_security_event", { p_event_id: event.id, p_clear_ip_block: clearIpBlock });
    if (error) setNotice(copy.failure); else {
      setNotice(securityText.updated);
      await Promise.all([loadEndoBotSecurityEvents(), loadAccounts(), loadPunishmentLogs()]);
    }
    setReviewingSecurityEventId(null);
  }

  async function loadSupportMessages(threadId: string) {
    const { data } = await supabase.from("account_support_messages").select("id,sender_id,body,created_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(100);
    setSupportMessages((data ?? []) as SupportMessage[]);
  }

  useEffect(() => { if (selectedSupportThread) void loadSupportMessages(selectedSupportThread.id); else setSupportMessages([]); }, [selectedSupportThread?.id]);

  useEffect(() => { selectedSupportThreadIdRef.current = selectedSupportThread?.id ?? null; }, [selectedSupportThread?.id]);

  useEffect(() => {
    if (!user || !adminGateUnlocked || !canSupportChat) return;
    const refreshSupportWorkspace = () => {
      void loadSupportThreads();
      const selectedId = selectedSupportThreadIdRef.current;
      if (selectedId) void loadSupportMessages(selectedId);
    };
    const channel = supabase
      .channel(`admin-support-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_support_threads" }, refreshSupportWorkspace)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_support_messages" }, refreshSupportWorkspace)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [adminGateUnlocked, canSupportChat, user?.id]);

  useEffect(() => {
    const nextExpiry = accounts.reduce<number | null>((closest, account) => {
      if (!account.expires_at) return closest;
      const timestamp = new Date(account.expires_at).getTime();
      if (timestamp <= Date.now()) return closest;
      return closest === null || timestamp < closest ? timestamp : closest;
    }, null);
    if (!nextExpiry) return;
    const timeout = window.setTimeout(() => void loadAccounts(), nextExpiry - Date.now() + 250);
    return () => window.clearTimeout(timeout);
  }, [accounts]);

  async function toggleMaintenance() {
    if (!isOwner || maintenanceSaving) return;
    const nextState = !maintenanceEnabled;
    setMaintenanceSaving(true); setNotice("");
    const { data, error } = await supabase.rpc("set_endoacolhe_maintenance", { p_enabled: nextState });
    if (error || typeof data !== "boolean") {
      setNotice(maintenanceText.failure);
    } else {
      setMaintenanceEnabled(data);
      window.dispatchEvent(new CustomEvent("endoacolhe:maintenance-updated", { detail: { enabled: data } }));
      setNotice(data ? maintenanceText.enabled : maintenanceText.disabled);
    }
    setMaintenanceSaving(false);
  }
  async function moderate(id: string, action: ModerationAction) {
    setBusyId(id); setNotice("");
    const { error } = await supabase.rpc("moderate_endoacolhe_story", { p_story_id: id, p_next_status: moderationStatus(action) });
    if (error) setNotice(copy.failure); else { setStories((current) => current.filter((story) => story.id !== id)); setNotice(copy.saved); }
    setBusyId(null);
  }

  function beginPostEdit(post: ManagedPost) {
    setEditingPost(post);
    setPostForm({ category: post.category, title: post.title, summary: post.summary, content: post.content });
  }

  function cancelPostEdit() {
    setEditingPost(null);
    setPostForm(emptyPostForm);
  }

  async function savePost(status: "draft" | "published") {
    if (!user) return;
    const payload = { category: postForm.category.trim(), title: postForm.title.trim(), summary: postForm.summary.trim(), content: postForm.content.trim() };
    if (!payload.category || !payload.title || !payload.summary || !payload.content) { setNotice(copy.required); return; }
    setSavingPost(status); setNotice("");
    const write = postWriteOperation(editingPost?.id ?? null);
    const result = write === "update" && editingPost
      ? await supabase.from("blog_posts").update({ ...payload, status, published_at: status === "published" ? editingPost.published_at ?? new Date().toISOString() : null }).eq("id", editingPost.id)
      : await supabase.from("blog_posts").insert({ author_id: user.id, ...payload, status, published_at: status === "published" ? new Date().toISOString() : null });
    if (result.error) setNotice(copy.failure); else { cancelPostEdit(); setNotice(write === "update" ? postEditorText.updated : copy.postSaved); await load(); }
    setSavingPost(null);
  }

  async function togglePostPinned(post: ManagedPost) {
    if (post.status !== "published" || pinningPostId) return;
    setPinningPostId(post.id); setNotice("");
    const { error } = await supabase.rpc("set_endoacolhe_blog_post_pinned", { p_post_id: post.id, p_is_pinned: !post.is_pinned });
    if (error) setNotice(copy.failure); else { setNotice(postPinText.saved); await load(); }
    setPinningPostId(null);
  }

  function openAccountAction(account: ManagedAccount, nextStatus: AccountStatus) {
    setAccountReason(nextStatus === "active" ? "" : account.reason ?? "");
    setAccountExpiresAt(nextStatus === "active" || !account.expires_at ? "" : account.expires_at.slice(0, 16));
    setAccountAction({ account, nextStatus });
  }

  async function manageAccount() {
    if (!accountAction) return;
    if (needsAccountReason(accountAction.nextStatus) && (accountReason.trim().length < 3 || accountReason.trim().length > 300)) { setNotice(copy.reasonRequired); return; }
    if (needsAccountReason(accountAction.nextStatus) && (!accountExpiresAt || new Date(accountExpiresAt).getTime() <= Date.now())) { setNotice(controlCopy.expiryInvalid); return; }
    setAccountSaving(true); setNotice("");
    const { error } = await supabase.rpc("manage_endoacolhe_account", {
      p_target_user_id: accountAction.account.user_id,
      p_next_status: accountAction.nextStatus,
      p_reason: accountAction.nextStatus === "active" ? null : accountReason.trim(),
      p_expires_at: accountAction.nextStatus === "active" || !accountExpiresAt ? null : new Date(accountExpiresAt).toISOString(),
    });
    if (error) setNotice(copy.failure);
    else { setNotice(copy.accountUpdated); setAccountAction(null); setAccountReason(""); setAccountExpiresAt(""); await loadAccounts(); }
    setAccountSaving(false);
  }

  async function sendPasswordReset() {
    if (!passwordResetAccount?.email) return;
    const limit = reserveAuthAttempt("admin-password-reset");
    if (!limit.allowed) { setNotice(passwordCopy.wait(limit.retryAfterSeconds)); return; }
    setPasswordResetting(true); setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(passwordResetAccount.email, { redirectTo: `${window.location.origin}/` });
    setPasswordResetting(false);
    if (error) setNotice(passwordCopy.failure);
    else { setNotice(passwordCopy.sent); setPasswordResetAccount(null); }
  }

  async function setPasswordDirectly() {
    if (!directPasswordAccount) return;
    if (!isPasswordValid(directPassword)) { setNotice(directCopy.invalid); return; }
    if (directPassword !== directPasswordConfirmation) { setNotice(directCopy.mismatch); return; }
    const limit = reserveAuthAttempt("admin-password-direct");
    if (!limit.allowed) { setNotice(passwordCopy.wait(limit.retryAfterSeconds)); return; }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setNotice(directCopy.failure); return; }
    setDirectPasswordSaving(true); setNotice("");
    try {
      const result = await fetch(`${apiBase}/api/admin-reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: directPasswordAccount.user_id, newPassword: directPassword }),
      });
      if (!result.ok) throw new Error("password update failed");
      setNotice(directCopy.saved); setDirectPasswordAccount(null); setDirectPassword(""); setDirectPasswordConfirmation("");
    } catch {
      setNotice(directCopy.failure);
    }
    setDirectPasswordSaving(false);
  }

  async function deleteContent() {
    if (!contentDeletion) return;
    setDeletingContent(true); setNotice("");
    const { error } = await supabase.rpc("delete_endoacolhe_content", { p_content_type: contentDeletion.kind, p_target_id: contentDeletion.id });
    if (error) setNotice(copy.failure);
    else {
      if (contentDeletion.kind === "story") setStories((current) => current.filter((story) => story.id !== contentDeletion.id));
      else setPosts((current) => current.filter((post) => post.id !== contentDeletion.id));
      setNotice(deletionCopy.deleted); setContentDeletion(null);
    }
    setDeletingContent(false);
  }

  async function deleteAccount() {
    if (!accountDeletion || deleteAccountConfirmation.trim().toUpperCase() !== controlCopy.deleteKeyword) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setNotice(controlCopy.deleteFailure); return; }
    setDeletingAccount(true); setNotice("");
    try {
      const result = await fetch(`${apiBase}/api/admin-delete-account`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetUserId: accountDeletion.user_id }) });
      if (!result.ok) throw new Error("account deletion failed");
      setNotice(controlCopy.deleted); setAccountDeletion(null); setDeleteAccountConfirmation(""); await loadAccounts();
    } catch { setNotice(controlCopy.deleteFailure); }
    setDeletingAccount(false);
  }

  async function resetAccountReputation() {
    if (!reputationResetAccount || reputationResetConfirmation.trim().toUpperCase() !== reputationCopy.keyword) return;
    setResettingReputation(true); setNotice("");
    const { error } = await supabase.rpc("reset_endoacolhe_account_reputation", { p_target_user_id: reputationResetAccount.user_id });
    if (error) setNotice(reputationCopy.failure);
    else { setNotice(reputationCopy.success); setReputationResetAccount(null); setReputationResetConfirmation(""); await Promise.all([loadAccounts(), loadPunishmentLogs()]); }
    setResettingReputation(false);
  }

  async function resetQuestionnaireLimit() {
    if (!questionnaireResetAccount || !canManageQuestionnaire) return;
    setQuestionnaireResetting(true); setNotice("");
    const { error } = await supabase.rpc("reset_endoacolhe_questionnaire_limit", { p_target_user_id: questionnaireResetAccount.user_id });
    if (error) setNotice(copy.questionnaireResetFailure);
    else { setNotice(copy.questionnaireResetSuccess); setQuestionnaireResetAccount(null); }
    setQuestionnaireResetting(false);
  }

  async function manageStaffRole() {
    if (!staffRoleAction) return;
    setAdministratorRoleSaving(true); setNotice("");
    const { error } = await supabase.rpc("manage_endoacolhe_staff_role", {
      p_target_user_id: staffRoleAction.account.user_id,
      p_next_role: staffRoleAction.role,
    });
    if (error) setNotice(roleCopy.failure);
    else { setNotice(roleCopy.updated); setStaffRoleAction(null); await loadAccounts(); }
    setAdministratorRoleSaving(false);
  }

  async function respondToSupport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = supportDraft.trim();
    if (!selectedSupportThread || !user || !body || supportSending) return;
    setSupportSending(true);
    const { error } = await supabase.from("account_support_messages").insert({ thread_id: selectedSupportThread.id, sender_id: user.id, body });
    if (error) setNotice(supportText.failure); else { setSupportDraft(""); await loadSupportMessages(selectedSupportThread.id); }
    setSupportSending(false);
  }

  const visibleStories = storyTriageFilter === "all" ? stories : stories.filter((story) => story.triage_status === storyTriageFilter);

  if (authLoading || checking) return <main className="admin-guard"><RefreshCw className="admin-spinner" size={20} /><p>{copy.checking}</p></main>;
  if (!user || !authorized) return authorizationError ? <main className="admin-guard admin-access-error" role="alert"><ShieldAlert size={30} /><h1>{accessErrorCopy.title}</h1><p>{accessErrorCopy.text}</p><button className="primary-button" type="button" onClick={() => void load()}><RefreshCw size={16} />{accessErrorCopy.retry}</button></main> : <main className="admin-guard"><RefreshCw className="admin-spinner" size={20} /><p>{copy.checking}</p></main>;
  if (!adminGateUnlocked) return <main className="admin-guard admin-access-gate"><ShieldCheck size={30} /><h1>{language === "en" ? "Additional access check" : language === "es" ? "Verificación adicional de acceso" : "Verificação adicional de acesso"}</h1><p>{language === "en" ? "Enter the additional administration password to continue. This protection expires after 12 hours." : language === "es" ? "Introduce la contraseña adicional de administración para continuar. Esta protección vence después de 12 horas." : "Digite a senha adicional da administração para continuar. Esta proteção vence após 12 horas."}</p><form onSubmit={unlockAdminAccess}><label>{language === "en" ? "Additional access password" : language === "es" ? "Contraseña adicional de acceso" : "Senha adicional de acesso"}<PasswordInput value={adminGatePassword} onChange={(event) => setAdminGatePassword(event.target.value)} autoComplete="current-password" maxLength={128} required showLabel={directCopy.showPassword} hideLabel={directCopy.hidePassword} /></label>{adminGateError ? <p className="admin-access-gate__error" role="alert">{adminGateError}</p> : null}<button className="primary-button" disabled={adminGateLoading} type="submit">{adminGateLoading ? <RefreshCw className="admin-spinner" size={16} /> : <ShieldCheck size={16} />}{adminGateLoading ? (language === "en" ? "Checking…" : language === "es" ? "Verificando…" : "Verificando…") : (language === "en" ? "Continue" : language === "es" ? "Continuar" : "Continuar")}</button></form></main>;

  return <main className="admin-page">
    <div className="admin-routebar"><a className="admin-return" href="/"><ArrowLeft size={16} /><span>EndoCare</span></a><div className="admin-routebar__context"><span><ShieldCheck size={15} />{copy.eyebrow}</span><strong>{user.name || copy.currentAdmin}</strong></div></div>
    <header className="admin-header"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div><button type="button" className="admin-refresh" onClick={() => void load()}><RefreshCw size={15} />{copy.refresh}</button></header>
    {notice ? <p className="admin-notice admin-page-notice" role="status">{notice}</p> : null}
    {isOwner ? <section className="admin-panel admin-maintenance-panel" aria-label={maintenanceText.title}><div className="admin-panel__heading"><span><Hammer size={18} />{maintenanceText.title}</span><em className={`admin-maintenance-status is-${maintenanceEnabled ? "on" : "off"}`}>{maintenanceEnabled ? maintenanceText.on : maintenanceText.off}</em></div><p className="admin-post-intro">{maintenanceText.description}</p><button type="button" className={`admin-maintenance-toggle is-${maintenanceEnabled ? "on" : "off"}`} onClick={() => void toggleMaintenance()} disabled={maintenanceSaving}>{maintenanceSaving ? <RefreshCw className="admin-spinner" size={15} /> : <Power size={15} />}{maintenanceSaving ? maintenanceText.saving : maintenanceEnabled ? maintenanceText.disable : maintenanceText.enable}</button></section> : null}

    <div className="admin-workspace">
    <aside className="admin-rail" aria-label={copy.eyebrow}><nav>{isOwner ? <a href="#admin-monitoring"><span><Activity size={16} />{monitoringText.title}</span><ChevronRight size={14} /></a> : null}{canManageQuestionnaire || canViewQuestionnaireResults ? <a href="#admin-questionnaire"><span><ClipboardList size={16} />{questionnaireNavText}</span><ChevronRight size={14} /></a> : null}{canViewUsers ? <a href="#admin-users"><span><Users size={16} />{copy.accountsTitle}</span><b>{accounts.length}</b><ChevronRight size={14} /></a> : null}{canViewPunishmentLogs ? <a href="#admin-punishments"><span><History size={16} />{language === "en" ? "Punishment log" : language === "es" ? "Registro de sanciones" : "Log de punições"}</span><ChevronRight size={14} /></a> : null}{isOwner ? <a href="#admin-endobot-supervision"><span><MessagesSquare size={16} />{language === "en" ? "Human EndoBot supervision" : language === "es" ? "Supervisión humana de EndoBot" : "Supervisão humana do EndoBot"}</span><ChevronRight size={14} /></a> : null}{isOwner ? <a href="#admin-endobot-security"><span><ShieldAlert size={16} />{securityText.title}</span><b>{endoBotSecurityEvents.filter((event) => !event.reviewed_at).length}</b><ChevronRight size={14} /></a> : null}{canSupportChat ? <a href="#admin-chat"><span><MessagesSquare size={16} />{language === "en" ? "Team chat" : language === "es" ? "Chat del equipo" : "Chat da equipe"}</span><ChevronRight size={14} /></a> : null}{canSupportChat ? <a href="#admin-support"><span><Headphones size={16} />{supportText.title}</span><b>{supportThreads.length}</b><ChevronRight size={14} /></a> : null}{canModerateStories ? <a href="#admin-stories"><span><ClipboardCheck size={16} />{copy.pending}</span><b>{pendingStoriesCount}</b><ChevronRight size={14} /></a> : null}{canManageBlog ? <a href="#admin-posts"><span><FilePlus2 size={16} />{copy.postTitle}</span><ChevronRight size={14} /></a> : null}</nav><p><History size={15} />{copy.auditNote}</p></aside>
    <div className="admin-content">
    {canManageQuestionnaire || canViewQuestionnaireResults ? <QuestionnaireAdmin canManage={canManageQuestionnaire} canViewResults={canViewQuestionnaireResults} /> : null}
    {isOwner ? <section id="admin-monitoring" className="admin-panel admin-monitoring-panel"><div className="admin-panel__heading"><span><Activity size={18} />{monitoringText.title}</span><div className="admin-monitoring-heading-actions"><div className="admin-monitoring-period"><button type="button" className={monitoringDays === 7 ? "is-active" : ""} onClick={() => void changeMonitoringDays(7)} disabled={monitoringLoading || monitoringResetting}>{monitoringText.sevenDays}</button><button type="button" className={monitoringDays === 30 ? "is-active" : ""} onClick={() => void changeMonitoringDays(30)} disabled={monitoringLoading || monitoringResetting}>{monitoringText.thirtyDays}</button></div><button type="button" className="admin-monitoring-reset" onClick={() => setMonitoringResetOpen(true)} disabled={monitoringLoading || monitoringResetting}><RotateCcw size={14} />{monitoringText.resetAction}</button></div></div><p className="admin-post-intro">{monitoringText.intro}</p>{monitoringLoading && !siteMonitoring ? <div className="admin-empty"><RefreshCw className="admin-spinner" size={22} /><p>{monitoringText.loading}</p></div> : siteMonitoring ? <><div className="admin-monitoring-summary"><article><span>{monitoringText.views}</span><strong>{siteMonitoring.overview.views}</strong></article><article><span>{monitoringText.sessions}</span><strong>{siteMonitoring.overview.sessions}</strong></article><article><span>{monitoringText.engaged}</span><strong>{siteMonitoring.overview.engaged_sessions}</strong></article><article><span>{monitoringText.errors}</span><strong>{siteMonitoring.overview.errors}</strong></article><article><span>{monitoringText.admin}</span><strong>{siteMonitoring.overview.admin_actions}</strong></article></div>{siteMonitoring.series.length ? <div className="admin-monitoring-chart"><h3>{monitoringText.trend}</h3><ResponsiveContainer width="100%" height={260}><AreaChart data={siteMonitoring.series} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="monitoringViews" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--plum, #7d3f62)" stopOpacity={0.32} /><stop offset="100%" stopColor="var(--plum, #7d3f62)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(99, 69, 86, 0.14)" /><XAxis dataKey="date" tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" })} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "long" })} /><Area type="monotone" dataKey="views" name={monitoringText.viewsShort} stroke="var(--plum, #7d3f62)" fill="url(#monitoringViews)" strokeWidth={2.4} /><Area type="monotone" dataKey="engaged_sessions" name={monitoringText.engagedShort} stroke="var(--sage, #5d7c6f)" fill="transparent" strokeWidth={2.1} /></AreaChart></ResponsiveContainer></div> : <div className="admin-empty"><Activity size={25} /><p>{monitoringText.noData}</p></div>}<div className="admin-monitoring-details"><section><h3>{monitoringText.routes}</h3>{siteMonitoring.routes.length ? <ul>{siteMonitoring.routes.map((item) => <li key={item.path}><span>{item.path}</span><strong>{item.views} {monitoringText.viewsShort.toLowerCase()} · {item.sessions} {monitoringText.sessionsShort.toLowerCase()}</strong></li>)}</ul> : <p>{monitoringText.noData}</p>}</section><section><h3>{monitoringText.admin}</h3><ul><li><span>{monitoringText.controls}</span><strong>{siteMonitoring.admin_actions.account_controls}</strong></li><li><span>{monitoringText.deletions}</span><strong>{siteMonitoring.admin_actions.content_deletions}</strong></li><li><span>{monitoringText.passwords}</span><strong>{siteMonitoring.admin_actions.password_actions}</strong></li><li><span>{monitoringText.roles}</span><strong>{siteMonitoring.admin_actions.role_changes}</strong></li></ul></section></div></> : <div className="admin-empty"><Activity size={25} /><p>{monitoringText.noData}</p></div>}</section> : null}
    {isOwner && adminGateUnlocked ? <EndoBotOwnerSupervision language={language} locale={locale} /> : null}
    {canViewUsers ? <section id="admin-users" className="admin-panel admin-accounts-panel" aria-labelledby="accounts-title">
      <div className="admin-panel__heading"><span><Users size={18} /> <span id="accounts-title">{copy.accountsTitle}</span></span><small>{accounts.length}</small></div>
      <p className="admin-post-intro">{copy.accountsIntro}</p>
      <p className="admin-audit-note"><History size={15} />{copy.auditNote}</p>
      {isOwner ? <p className="admin-owner-note"><ShieldCheck size={16} /><span><strong>{roleCopy.owner}</strong> — {roleCopy.ownerNote}</span></p> : null}
      <form className="admin-account-filters" onSubmit={(event) => { event.preventDefault(); void loadAccounts(); }}>
        <label className="admin-account-search"><Search size={16} /><span className="sr-only">{copy.searchAccounts}</span><input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder={copy.searchAccounts} maxLength={120} /></label>
        <label className="admin-account-status"><span>{copy.statusFilter}</span><select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}><option value="all">{copy.all}</option><option value="active">{copy.active}</option><option value="restricted">{copy.restricted}</option><option value="suspended">{copy.suspended}</option></select></label>
        <button className="admin-refresh" type="submit" disabled={accountsLoading}>{accountsLoading ? <RefreshCw className="admin-spinner" size={15} /> : <Search size={15} />}{copy.search}</button>
      </form>
      {accounts.length ? <div className="admin-account-list">{accounts.map((account) => {
        const manageable = canManageAccount(account, user.id);
        const passwordManageable = isOwner ? account.user_id !== user.id && !account.is_owner : manageable;
        const roleManageable = canManageRoles && canManageAdministratorRole(account, user.id, isOwner);
        const canResetReputation = canResetPunishmentReputation(account, user.id, isOwner);
        const assignedRole = account.is_owner ? "owner" : account.admin_role;
        const reputation = punishmentReputation(account.punishment_count);
        return <article className="admin-account" key={account.user_id}>
          <div className="admin-account__identity"><div><strong>{account.display_name || account.email || account.user_id}</strong><span>{account.email || account.user_id}</span></div><div className="admin-account__badges"><em className={`account-status is-${account.status}`}>{statusLabel(account.status, copy)}</em>{assignedRole ? <em className={`account-role-${assignedRole}`}>{roleLabels[assignedRole]}</em> : null}<em className={`account-reputation-${reputation}`}>{reputationLabels[reputation]}</em></div></div>
          <div className="admin-account__details"><span>{copy.accountSince} {new Date(account.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}</span><span><b>{copy.accountReason}:</b> {account.reason || copy.noReason}</span>{account.expires_at ? <span className="admin-account-expiry"><Timer size={14} /> {controlCopy.expiryAt} {new Date(account.expires_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span> : null}</div>
          <div className="admin-account__actions">{manageable && canApplyPunishments ? accountActionsFor(account.status).map((nextStatus) => <button key={nextStatus} className={nextStatus === "active" ? "admin-restore" : nextStatus === "restricted" ? "admin-restrict" : "admin-suspend"} type="button" onClick={() => openAccountAction(account, nextStatus)}>{nextStatus === "active" ? <RotateCcw size={15} /> : nextStatus === "restricted" ? <Ban size={15} /> : <ShieldAlert size={15} />}{actionLabel(nextStatus, copy)}</button>) : null}{passwordManageable && canSendPasswordReset && account.email ? <button className="admin-reset-password" type="button" onClick={() => setPasswordResetAccount(account)}><KeyRound size={15} />{passwordCopy.action}</button> : null}{passwordManageable && canResetPasswordDirectly ? <button className="admin-direct-password" type="button" onClick={() => { setDirectPasswordAccount(account); setDirectPassword(""); setDirectPasswordConfirmation(""); }}><LockKeyhole size={15} />{directCopy.action}</button> : null}{canResetReputation ? <button className="admin-reputation-reset" type="button" onClick={() => { setReputationResetAccount(account); setReputationResetConfirmation(""); }}><Eraser size={15} />{reputationCopy.action}</button> : null}{canManageQuestionnaire ? <button className="admin-questionnaire-reset" type="button" onClick={() => setQuestionnaireResetAccount(account)}><RotateCcw size={15} />{copy.questionnaireReset}</button> : null}{manageable && canDeleteAccounts ? <button className="admin-account-delete" type="button" onClick={() => { setAccountDeletion(account); setDeleteAccountConfirmation(""); }}><UserRoundX size={15} />{controlCopy.deleteAccount}</button> : null}{roleManageable ? <button className="admin-role-grant" type="button" onClick={() => setStaffRoleAction({ account, role: account.admin_role })}><ShieldCheck size={15} />{language === "en" ? "Set role" : language === "es" ? "Definir cargo" : "Definir cargo"}</button> : null}{!manageable && !roleManageable && !passwordManageable ? <span className="admin-account-locked">{account.user_id === user.id ? copy.currentAdmin : account.is_owner ? roleCopy.owner : copy.accountActionLocked}</span> : null}</div>
        </article>;
      })}</div> : <div className="admin-empty"><Users size={25} /><p>{copy.noAccounts}</p></div>}
    </section> : null}
    {canViewPunishmentLogs ? <section id="admin-punishments" className="admin-panel admin-punishment-panel"><div className="admin-panel__heading"><span><History size={18} />{language === "en" ? "Punishment log" : language === "es" ? "Registro de sanciones" : "Log de punições"}</span><small>{punishmentLogs.length}</small></div><p className="admin-post-intro">{language === "en" ? "Traceable record of administrative account status changes." : language === "es" ? "Registro verificable de cambios administrativos de estado de cuenta." : "Registro rastreável das mudanças administrativas de status de conta."}</p>{punishmentLogs.length ? <div className="admin-punishment-list">{punishmentLogs.map((item) => <article key={item.id}><div><strong>{item.target_name || item.target_email || "—"}</strong><span>{item.previous_status} → {item.next_status}</span></div><p><b>{language === "en" ? "By" : language === "es" ? "Por" : "Por"}:</b> {item.actor_name || item.actor_email || "—"} · {new Date(item.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p><p>{item.reason || copy.noReason}{item.expires_at ? ` · ${controlCopy.expiryAt}: ${new Date(item.expires_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : ""}</p></article>)}</div> : <div className="admin-empty"><History size={25} /><p>{language === "en" ? "No punishment records yet." : language === "es" ? "Aún no hay registros de sanciones." : "Ainda não há registros de punições."}</p></div>}</section> : null}
    {isOwner ? <section id="admin-endobot-security" className="admin-panel admin-endobot-security"><div className="admin-panel__heading"><span><ShieldAlert size={18} />{securityText.title}</span><small>{endoBotSecurityEvents.filter((event) => !event.reviewed_at).length}</small></div><p className="admin-post-intro">{securityText.intro}</p>{endoBotSecurityEvents.length ? <div className="admin-endobot-security__list">{endoBotSecurityEvents.map((event) => <article key={event.id}><div className="admin-endobot-security__meta"><div><strong>{event.user_name || event.user_email || securityText.noAccount}</strong><span>{securityText.byNetwork}: {event.ip_fingerprint.slice(0, 12)}…</span></div><em className={`admin-endobot-security__action is-${event.action}`}>{event.action === "suspended" ? securityText.suspended : event.action === "ip_blocked" ? securityText.ipBlocked : securityText.blocked}</em></div><div className="admin-endobot-security__labels"><em className={`admin-endobot-security__severity is-${event.severity ?? "medium"}`}>{securityLabels.severities[event.severity ?? "medium"]} · {event.risk_score ?? 3}/5</em><span>{securityLabels.categories[event.category ?? "prompt_injection"]} · {securityLabels.sources[event.source ?? "input"]}</span></div><p>{event.signals.map((signal) => securityLabels.signals[signal as keyof typeof securityLabels.signals] ?? signal).join(" · ")}</p><time>{new Date(event.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}{event.expires_at ? ` · ${controlCopy.expiryAt}: ${new Date(event.expires_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : ""}</time><div className="admin-endobot-security__actions">{event.reviewed_at ? <span><CheckCircle2 size={15} />{securityText.reviewed}</span> : <button type="button" className="admin-edit-content" disabled={reviewingSecurityEventId === event.id} onClick={() => void reviewEndoBotSecurityEvent(event, false)}>{reviewingSecurityEventId === event.id ? <RefreshCw className="admin-spinner" size={15} /> : <Check size={15} />}{securityText.review}</button>}{event.action !== "blocked" ? <button type="button" className="admin-restore" disabled={reviewingSecurityEventId === event.id} onClick={() => void reviewEndoBotSecurityEvent(event, true)}><RotateCcw size={15} />{securityText.clear}</button> : null}</div></article>)}</div> : <div className="admin-empty"><ShieldAlert size={25} /><p>{securityText.empty}</p></div>}</section> : null}

    {canSupportChat ? <AdminChat userId={user.id} language={language} locale={locale} canChat={canSupportChat} canDeleteAny={isOwner} /> : null}
    {canSupportChat ? <section id="admin-support" className="admin-panel admin-support-panel"><div className="admin-panel__heading"><span><Headphones size={18} />{supportText.title}</span><small>{supportThreads.length}</small></div><p className="admin-post-intro">{supportText.intro}</p>{supportThreads.length ? <div className="admin-support-workspace"><div className="admin-support-thread-list">{supportThreads.map((thread) => <button type="button" className={selectedSupportThread?.id === thread.id ? "is-active" : ""} key={thread.id} onClick={() => setSelectedSupportThread(thread)}><strong>{accounts.find((account) => account.user_id === thread.requester_id)?.display_name || accounts.find((account) => account.user_id === thread.requester_id)?.email || thread.requester_id}</strong><span>{supportText.open} · {new Date(thread.updated_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span></button>)}</div>{selectedSupportThread ? <div className="admin-support-chat"><div className="admin-support-history">{supportMessages.map((message) => <article className={message.sender_id === user.id ? "is-admin" : "is-user"} key={message.id}><strong>{message.sender_id === user.id ? supportText.administration : supportText.user}</strong><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</time></article>)}</div><form onSubmit={respondToSupport}><label className="sr-only" htmlFor="admin-support-reply">{supportText.send}</label><textarea id="admin-support-reply" value={supportDraft} onChange={(event) => setSupportDraft(event.target.value)} onKeyDown={handleMessageComposerKeyDown} placeholder={supportText.placeholder} maxLength={1200} rows={3} required /><button className="admin-approve" type="submit" disabled={supportSending || !supportDraft.trim()}>{supportSending ? <RefreshCw className="admin-spinner" size={15} /> : <Send size={15} />}{supportSending ? supportText.sending : supportText.send}</button></form></div> : <div className="admin-empty"><Headphones size={25} /><p>{supportText.select}</p></div>}</div> : <div className="admin-empty"><Headphones size={25} /><p>{supportText.empty}</p></div>}</section> : null}
    {canModerateStories ? <section id="admin-stories" className="admin-panel"><div className="admin-panel__heading"><span><ClipboardCheck size={18} />{deletionCopy.storiesTitle}</span><small>{visibleStories.length}/{stories.length}</small></div><p className="admin-post-intro">{triageText.intro}</p><label className="admin-story-triage-filter">{language === "en" ? "Triage filter" : language === "es" ? "Filtro de triage" : "Filtro da triagem"}<select value={storyTriageFilter} onChange={(event) => setStoryTriageFilter(event.target.value as typeof storyTriageFilter)}><option value="all">{triageText.all}</option><option value="needs_review">{triageText.needs_review}</option><option value="likely_spam">{triageText.likely_spam}</option><option value="adequate">{triageText.adequate}</option></select></label>{visibleStories.length ? <div className="admin-story-list">{visibleStories.map((story) => <article className="admin-story" key={story.id}><div className="admin-story__meta"><strong>{story.author_alias}</strong><span>{new Date(story.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })} · {story.helpfulness}/5</span></div><em className={`story-triage-status is-${story.triage_status}`}>{triageText[story.triage_status]}</em><p>{story.content}</p><div className="admin-story__actions">{story.status === "pending" ? <><button type="button" className="admin-reject" onClick={() => void moderate(story.id, "reject")} disabled={busyId === story.id}><X size={15} />{copy.reject}</button><button type="button" className="admin-approve" onClick={() => void moderate(story.id, "approve")} disabled={busyId === story.id}><Check size={15} />{copy.approve}</button></> : <em className={`content-status is-${story.status}`}>{story.status === "approved" ? copy.approve : copy.reject}</em>}{canManageContent ? <button type="button" className="admin-delete-content" onClick={() => setContentDeletion({ kind: "story", id: story.id, label: story.author_alias })}><Trash2 size={15} />{deletionCopy.delete}</button> : null}</div></article>)}</div> : <div className="admin-empty"><ClipboardCheck size={25} /><p>{deletionCopy.noStories}</p></div>}</section> : null}
    {canManageBlog ? <section id="admin-posts" className="admin-panel admin-post-panel"><div className="admin-panel__heading"><span><FilePlus2 size={18} />{editingPost ? postEditorText.editing : copy.postTitle}</span>{editingPost ? <button type="button" className="admin-edit-cancel" onClick={cancelPostEdit}>{postEditorText.cancel}</button> : null}</div><p className="admin-post-intro">{copy.postIntro}</p><form className="admin-post-form" onSubmit={(event) => { event.preventDefault(); void savePost("published"); }}><label>{copy.category}<input value={postForm.category} onChange={(event) => setPostForm((current) => ({ ...current, category: event.target.value }))} maxLength={80} placeholder={copy.categoryHint} /></label><label>{copy.postName}<input value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} maxLength={180} placeholder={copy.titleHint} /></label><label>{copy.summary}<textarea value={postForm.summary} onChange={(event) => setPostForm((current) => ({ ...current, summary: event.target.value }))} maxLength={600} rows={3} placeholder={copy.summaryHint} /></label><label>{copy.content}<textarea value={postForm.content} onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))} rows={10} placeholder={copy.contentHint} /></label><div className="admin-post-actions"><button type="button" className="admin-refresh" onClick={() => void savePost("draft")} disabled={savingPost !== null}>{editingPost ? postEditorText.saveDraft : copy.saveDraft}</button><button className="admin-approve" type="submit" disabled={savingPost !== null}>{savingPost === "published" ? <RefreshCw className="admin-spinner" size={15} /> : <BookOpenCheck size={15} />}{editingPost ? postEditorText.publish : copy.publish}</button></div></form><div className="admin-post-list"><div className="admin-panel__heading"><span><BookOpenCheck size={18} />{copy.recentPosts}</span><small>{posts.length}</small></div>{posts.length ? <ul>{posts.map((post) => <li key={post.id}><span><strong>{post.title}</strong><time>{new Date(post.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}</time></span><span className="admin-post-list__actions"><em className={post.status === "published" ? "is-published" : "is-draft"}>{post.status === "published" ? copy.published : copy.draft}</em>{post.is_pinned ? <em className="admin-post-pinned"><Pin size={13} />{postPinText.pinned}</em> : null}{post.status === "published" ? <button type="button" className="admin-edit-content admin-pin-post" disabled={pinningPostId === post.id} onClick={() => void togglePostPinned(post)}>{pinningPostId === post.id ? <RefreshCw className="admin-spinner" size={15} /> : post.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}{post.is_pinned ? postPinText.unpin : postPinText.pin}</button> : null}<button type="button" className="admin-edit-content" onClick={() => beginPostEdit(post)}><Pencil size={15} />{postEditorText.edit}</button><button type="button" className="admin-delete-content" onClick={() => setContentDeletion({ kind: "post", id: post.id, label: post.title })}><Trash2 size={15} />{deletionCopy.delete}</button></span></li>)}</ul> : <div className="admin-empty"><BookOpenCheck size={25} /><p>{copy.noPosts}</p></div>}</div></section> : null}
    </div>
    </div>
    <SiteCopyright className="admin-site-copyright" />
    <AlertDialog open={Boolean(accountAction)} onOpenChange={(open) => { if (!open && !accountSaving) setAccountAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{copy.confirmTitle}</AlertDialogTitle><AlertDialogDescription>{actionDescription}</AlertDialogDescription></AlertDialogHeader>{accountAction && needsAccountReason(accountAction.nextStatus) ? <><label className="admin-dialog-reason">{copy.accountReason}<textarea value={accountReason} onChange={(event) => setAccountReason(event.target.value)} maxLength={300} rows={4} placeholder={copy.reasonPlaceholder} /></label><div className="admin-control-form"><label>{controlCopy.expiry}<input type="datetime-local" value={accountExpiresAt} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} onChange={(event) => setAccountExpiresAt(event.target.value)} required /></label><small>{controlCopy.expiryHint}</small></div></> : null}<AlertDialogFooter><AlertDialogCancel disabled={accountSaving}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className={accountAction?.nextStatus === "suspended" ? "admin-dialog-suspend" : ""} disabled={accountSaving} onClick={(event) => { event.preventDefault(); void manageAccount(); }}>{accountSaving ? <RefreshCw className="admin-spinner" size={15} /> : <CheckCircle2 size={15} />}{copy.confirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(passwordResetAccount)} onOpenChange={(open) => { if (!open && !passwordResetting) setPasswordResetAccount(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{passwordCopy.title}</AlertDialogTitle><AlertDialogDescription>{passwordCopy.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={passwordResetting}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-reset-password" disabled={passwordResetting} onClick={(event) => { event.preventDefault(); void sendPasswordReset(); }}>{passwordResetting ? <RefreshCw className="admin-spinner" size={15} /> : <KeyRound size={15} />}{passwordCopy.action}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(directPasswordAccount)} onOpenChange={(open) => { if (!open && !directPasswordSaving) { setDirectPasswordAccount(null); setDirectPassword(""); setDirectPasswordConfirmation(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{directCopy.title}</AlertDialogTitle><AlertDialogDescription>{directCopy.description}</AlertDialogDescription></AlertDialogHeader><div className="admin-direct-password-form"><label>{directCopy.password}<PasswordInput value={directPassword} onChange={(event) => setDirectPassword(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" showLabel={directCopy.showPassword} hideLabel={directCopy.hidePassword} /></label><PasswordStrengthMeter password={directPassword} /><label>{directCopy.confirmation}<PasswordInput value={directPasswordConfirmation} onChange={(event) => setDirectPasswordConfirmation(event.target.value)} minLength={10} maxLength={128} autoComplete="new-password" showLabel={directCopy.showPassword} hideLabel={directCopy.hidePassword} /></label></div><AlertDialogFooter><AlertDialogCancel disabled={directPasswordSaving}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-direct-password" disabled={directPasswordSaving || !directPassword || !directPasswordConfirmation} onClick={(event) => { event.preventDefault(); void setPasswordDirectly(); }}>{directPasswordSaving ? <RefreshCw className="admin-spinner" size={15} /> : <LockKeyhole size={15} />}{directCopy.action}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(contentDeletion)} onOpenChange={(open) => { if (!open && !deletingContent) setContentDeletion(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deletionCopy.title}</AlertDialogTitle><AlertDialogDescription>{contentDeletion?.kind === "story" ? deletionCopy.story : deletionCopy.post}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletingContent}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-dialog-suspend" disabled={deletingContent} onClick={(event) => { event.preventDefault(); void deleteContent(); }}>{deletingContent ? <RefreshCw className="admin-spinner" size={15} /> : <Trash2 size={15} />}{deletionCopy.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(accountDeletion)} onOpenChange={(open) => { if (!open && !deletingAccount) { setAccountDeletion(null); setDeleteAccountConfirmation(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{controlCopy.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{controlCopy.deleteDescription}</AlertDialogDescription></AlertDialogHeader><div className="admin-delete-account-copy"><strong>{accountDeletion?.display_name || accountDeletion?.email}</strong><label>{controlCopy.deletePrompt}<input value={deleteAccountConfirmation} onChange={(event) => setDeleteAccountConfirmation(event.target.value)} maxLength={16} autoComplete="off" /></label></div><AlertDialogFooter><AlertDialogCancel disabled={deletingAccount}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-dialog-suspend" disabled={deletingAccount || deleteAccountConfirmation.trim().toUpperCase() !== controlCopy.deleteKeyword} onClick={(event) => { event.preventDefault(); void deleteAccount(); }}>{deletingAccount ? <RefreshCw className="admin-spinner" size={15} /> : <Trash2 size={15} />}{controlCopy.deleteConfirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(questionnaireResetAccount)} onOpenChange={(open) => { if (!open && !questionnaireResetting) setQuestionnaireResetAccount(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{copy.questionnaireResetTitle}</AlertDialogTitle><AlertDialogDescription>{copy.questionnaireResetDescription}</AlertDialogDescription></AlertDialogHeader><div className="admin-questionnaire-reset-copy"><strong>{questionnaireResetAccount?.display_name || questionnaireResetAccount?.email}</strong><span>{questionnaireResetAccount?.email}</span></div><AlertDialogFooter><AlertDialogCancel disabled={questionnaireResetting}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-questionnaire-reset" disabled={questionnaireResetting} onClick={(event) => { event.preventDefault(); void resetQuestionnaireLimit(); }}>{questionnaireResetting ? <RefreshCw className="admin-spinner" size={15} /> : <RotateCcw size={15} />}{questionnaireResetting ? copy.questionnaireResetting : copy.questionnaireResetConfirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(staffRoleAction)} onOpenChange={(open) => { if (!open && !administratorRoleSaving) setStaffRoleAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{language === "en" ? "Set staff role" : language === "es" ? "Definir cargo de equipo" : "Definir cargo da equipe"}</AlertDialogTitle><AlertDialogDescription>{language === "en" ? "Only the Owner can change administrative roles. The change applies immediately." : language === "es" ? "Solo el Dueño puede cambiar cargos administrativos. El cambio se aplica de inmediato." : "Somente o Dono pode alterar cargos administrativos. A mudança é aplicada imediatamente."}</AlertDialogDescription></AlertDialogHeader><div className="admin-role-confirmation"><strong>{staffRoleAction?.account.display_name || staffRoleAction?.account.email}</strong><span>{staffRoleAction?.account.email}</span><label>{language === "en" ? "Role" : language === "es" ? "Cargo" : "Cargo"}<select value={staffRoleAction?.role ?? "none"} onChange={(event) => setStaffRoleAction((current) => current ? { ...current, role: event.target.value === "none" ? null : event.target.value as AssignableStaffRole } : current)}><option value="none">{roleLabels.none}</option><option value="support">{roleLabels.support}</option><option value="moderator">{roleLabels.moderator}</option><option value="admin">{roleLabels.admin}</option></select></label></div><AlertDialogFooter><AlertDialogCancel disabled={administratorRoleSaving}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className={staffRoleAction?.role === null ? "admin-dialog-suspend" : "admin-role-grant"} disabled={administratorRoleSaving} onClick={(event) => { event.preventDefault(); void manageStaffRole(); }}>{administratorRoleSaving ? <RefreshCw className="admin-spinner" size={15} /> : <ShieldCheck size={15} />}{language === "en" ? "Confirm role" : language === "es" ? "Confirmar cargo" : "Confirmar cargo"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(reputationResetAccount)} onOpenChange={(open) => { if (!open && !resettingReputation) { setReputationResetAccount(null); setReputationResetConfirmation(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{reputationCopy.title}</AlertDialogTitle><AlertDialogDescription>{reputationCopy.description}</AlertDialogDescription></AlertDialogHeader><div className="admin-delete-account-copy admin-reputation-reset-copy"><strong>{reputationResetAccount?.display_name || reputationResetAccount?.email}</strong><label>{reputationCopy.prompt}<input value={reputationResetConfirmation} onChange={(event) => setReputationResetConfirmation(event.target.value)} maxLength={16} autoComplete="off" /></label></div><AlertDialogFooter><AlertDialogCancel disabled={resettingReputation}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-reputation-reset" disabled={resettingReputation || reputationResetConfirmation.trim().toUpperCase() !== reputationCopy.keyword} onClick={(event) => { event.preventDefault(); void resetAccountReputation(); }}>{resettingReputation ? <RefreshCw className="admin-spinner" size={15} /> : <Eraser size={15} />}{reputationCopy.confirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={monitoringResetOpen} onOpenChange={(open) => { if (!open && !monitoringResetting) setMonitoringResetOpen(false); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{monitoringText.resetTitle}</AlertDialogTitle><AlertDialogDescription>{monitoringText.resetDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={monitoringResetting}>{copy.cancel}</AlertDialogCancel><AlertDialogAction className="admin-dialog-suspend" disabled={monitoringResetting} onClick={(event) => { event.preventDefault(); void resetMonitoring(); }}>{monitoringResetting ? <RefreshCw className="admin-spinner" size={15} /> : <RotateCcw size={15} />}{monitoringResetting ? monitoringText.resetting : monitoringText.resetConfirm}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AccountSettingsDialog />
  </main>;
}
