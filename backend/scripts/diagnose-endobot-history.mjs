import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This diagnostic never uses an existing person's session or conversation.
// Network/database writes require an explicit execution, UI preparation, or
// cleanup flag. A prepared UI account is retained only until --cleanup-only.
const cleanupOnly = process.argv.includes('--cleanup-only');
const prepareUi = process.argv.includes('--prepare-ui');
const execute = process.argv.includes('--execute') || cleanupOnly || prepareUi;
if (!execute) {
  console.log('Review only. --execute tests authenticated history with a disposable account and cleans it up; --prepare-ui retains one disposable UI account until --cleanup-only. No email is sent.');
  process.exit(0);
}

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const journalPath = resolve(backendRoot, '.local-run', 'endobot-history-diagnostic.json');
const uiCredentialsPath = resolve(backendRoot, '.local-run', 'endobot-ui-test.json');
if (cleanupOnly && !existsSync(journalPath)) {
  if (existsSync(uiCredentialsPath)) unlinkSync(uiCredentialsPath);
  console.log(JSON.stringify({ stage: 'cleanup_local_ui_credentials', ok: true, journalAbsent: true }));
  process.exit(0);
}
if (!cleanupOnly && existsSync(uiCredentialsPath)) throw new Error('Previous UI diagnostic credentials remain. Use --cleanup-only first.');
const frontendEnvPath = resolve(backendRoot, '..', '..', 'EndoCare-local-backup-main', 'frontend', '.env');
const frontendEnv = readFileSync(frontendEnvPath, 'utf8');
function frontendField(name) {
  const value = frontendEnv.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim();
  return value?.replace(/^(["'])(.*)\1$/, '$2');
}
const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = frontendField('VITE_SUPABASE_PUBLISHABLE_KEY');
if (!projectUrl || !serviceKey || !publicKey || projectUrl !== frontendField('VITE_SUPABASE_URL')) {
  console.error('Diagnostic configuration missing or frontend/backend Supabase projects differ.');
  process.exit(1);
}

const journal = cleanupOnly ? JSON.parse(readFileSync(journalPath, 'utf8')) : null;
if (journal && (journal.projectUrl !== projectUrl || !/^[0-9a-f-]{36}$/i.test(journal.runId) || !/^[0-9a-f-]{36}$/i.test(journal.userId))) {
  throw new Error('Cleanup journal does not match this project or contains invalid identifiers.');
}
if (!cleanupOnly && existsSync(journalPath)) throw new Error('Previous diagnostic cleanup is pending. Use --cleanup-only first.');
const runId = journal?.runId ?? randomUUID();
const userId = journal?.userId ?? randomUUID();
const email = `endobot-diagnostic-${runId}@example.invalid`;
const password = `Diag!${randomBytes(36).toString('base64url')}9`;
const secrets = [serviceKey, publicKey, email, password, userId, runId];
const sanitize = (value) => {
  let result = String(value ?? '').slice(0, 1000);
  for (const secret of secrets) result = result.replaceAll(secret, '[redacted]');
  return result.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '[identifier]');
};
const report = (stage, result, extra = {}) => console.log(JSON.stringify({
  stage,
  ok: !result.error,
  status: result.status ?? result.error?.status,
  ...(result.error ? { code: result.error.code ?? result.error.name, message: sanitize(result.error.message) } : {}),
  ...extra,
}));
const fetchWithDeadline = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) });
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchWithDeadline } };
const admin = createClient(projectUrl, serviceKey, options);
const authenticated = createClient(projectUrl, publicKey, options);
let createAttempted = cleanupOnly;
let failed = false;
let uiPrepared = false;

try {
  if (!cleanupOnly) {
  // A chosen UUID makes recovery possible without listing or searching users.
  const prior = await admin.auth.admin.getUserById(userId);
  if (prior.data.user || (prior.error && prior.error.status !== 404)) {
    report('verify_disposable_id_unused', prior);
    throw new Error('Disposable user identifier could not be confirmed unused.');
  }
  // The journal contains only scope identifiers, never credentials, so cleanup
  // can be retried after an interrupted shell or lost createUser response.
  mkdirSync(dirname(journalPath), { recursive: true });
  writeFileSync(journalPath, JSON.stringify({ projectUrl, runId, userId }), { flag: 'wx' });
  createAttempted = true;
  const created = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'EndoBot diagnostic', diagnostic_run: runId },
    app_metadata: { endobot_diagnostic_run: runId },
  });
  report('create_disposable_user', created);
  if (created.error || created.data.user?.id !== userId) throw new Error('Disposable user creation failed.');

  const session = await authenticated.auth.signInWithPassword({ email, password });
  report('authenticate_disposable_user', session);
  if (session.error || !session.data.session || session.data.user?.id !== userId) throw new Error('Disposable authentication failed.');
  const token = session.data.session.access_token;
  secrets.push(token);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  if (claims.role !== 'authenticated' || claims.sub !== userId) throw new Error('Diagnostic session must use the authenticated role.');
  console.log(JSON.stringify({ stage: 'verify_authenticated_role', ok: true }));

  const activeAccount = await authenticated.rpc('is_endoacolhe_account_active');
  report('check_disposable_account_active', activeAccount, { active: activeAccount.data === true });
  if (activeAccount.error || activeAccount.data !== true) throw new Error('Disposable account access was not validated; history writes skipped.');

  if (prepareUi) {
    writeFileSync(uiCredentialsPath, JSON.stringify({ email, password }), { flag: 'wx', mode: 0o600 });
    uiPrepared = true;
    console.log(JSON.stringify({ stage: 'prepare_authenticated_ui_test', ok: true, credentialsSavedLocally: true, cleanupRequired: true }));
  } else {
  const columns = 'id,category,language,title,updated_at,human_review_consent,human_takeover_status';
  const schema = await authenticated.from('endobot_conversations').select(columns).limit(0);
  report('authenticated_history_select', schema, { rowCount: schema.data?.length });
  const conversation = await authenticated.from('endobot_conversations').insert({
    owner_id: userId,
    category: 'Informações gerais',
    language: 'pt',
    title: 'teste',
    human_review_consent: true,
    human_review_consent_at: new Date().toISOString(),
    human_review_consent_version: '2026-08-27',
  }).select(columns).single();
  report('authenticated_create_conversation', conversation);
  if (conversation.error || !conversation.data?.id) throw new Error('Authenticated conversation creation failed.');
  const message = await authenticated.from('endobot_messages').insert({
    conversation_id: conversation.data.id,
    role: 'user',
    content: 'teste',
  }).select('id').single();
  report('authenticated_persist_question', message);
  if (message.error || !message.data?.id) throw new Error('Authenticated question persistence failed.');
  const answer = await fetch('http://127.0.0.1:3000/api/endobot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question: 'teste', history: [], preferredLanguage: 'pt', conversationId: conversation.data.id }),
    signal: AbortSignal.timeout(95_000),
  });
  const body = await answer.json();
  console.log(JSON.stringify({ stage: 'authenticated_local_endobot_answer', ok: answer.ok && typeof body.answer === 'string' && Boolean(body.answer.trim()), status: answer.status, code: body.code, answerPresent: typeof body.answer === 'string' && Boolean(body.answer.trim()) }));
  if (!answer.ok || typeof body.answer !== 'string' || !body.answer.trim()) throw new Error('Authenticated EndoBot answer failed.');
  }
  }
} catch (error) {
  failed = true;
  console.error(JSON.stringify({ stage: 'diagnostic_failure', message: sanitize(error?.message) }));
} finally {
  if (createAttempted && !uiPrepared) {
    try {
      const current = await admin.auth.admin.getUserById(userId);
      if (current.error?.status === 404 && !current.data.user) {
        console.log(JSON.stringify({ stage: 'cleanup', ok: true, accountAbsent: true }));
        unlinkSync(journalPath);
      } else if (current.error || current.data.user?.id !== userId || current.data.user.app_metadata?.endobot_diagnostic_run !== runId) {
        failed = true;
        report('cleanup_verify_disposable_owner', current);
        console.error('Cleanup refused: disposable account marker could not be validated.');
      } else {
        // Conversation deletion cascades to messages/audit before deleting the
        // account, whose audit foreign key otherwise uses ON DELETE RESTRICT.
        const conversations = await admin.from('endobot_conversations').delete().eq('owner_id', userId).select('id');
        report('cleanup_disposable_conversations', conversations, { deleted: conversations.data?.length });
        if (conversations.error) throw new Error('Conversation cleanup failed; account retained to allow recovery.');
        const removed = await admin.auth.admin.deleteUser(userId, false);
        report('cleanup_disposable_account', removed);
        if (removed.error) throw new Error('Disposable account cleanup failed.');
        const verification = await admin.auth.admin.getUserById(userId);
        const accountAbsent = verification.error?.status === 404 && !verification.data.user;
        console.log(JSON.stringify({ stage: 'verify_cleanup', ok: accountAbsent }));
        if (!accountAbsent) throw new Error('Disposable account deletion could not be verified.');
        unlinkSync(journalPath);
      }
    } catch (error) {
      failed = true;
      console.error(JSON.stringify({ stage: 'cleanup_failure', message: sanitize(error?.message) }));
    } finally {
      try {
        if (existsSync(uiCredentialsPath)) unlinkSync(uiCredentialsPath);
        console.log(JSON.stringify({ stage: 'cleanup_local_ui_credentials', ok: !existsSync(uiCredentialsPath) }));
      } catch {
        failed = true;
        console.error(JSON.stringify({ stage: 'cleanup_local_ui_credentials', ok: false }));
      }
    }
  }
}
process.exitCode = failed ? 1 : 0;
