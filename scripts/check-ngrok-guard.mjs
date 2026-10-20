const port = process.env.ENDOCARE_NGROK_GUARD_PORT || "5174";
const username = process.env.ENDOCARE_NGROK_USER;
const password = process.env.ENDOCARE_NGROK_PASSWORD;
const cookieToken = process.env.ENDOCARE_NGROK_COOKIE;
const baseUrl = `http://127.0.0.1:${port}`;
const basicAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

if (!username || !password || !cookieToken) {
  console.error("A verificacao local do Ngrok nao recebeu as credenciais temporarias.");
  process.exit(1);
}

let protectedPage;
let anonymousPage;
let lastError;
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    [anonymousPage, protectedPage] = await Promise.all([
      fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(4_000) }),
      fetch(`${baseUrl}/api/health`, { headers: { authorization: basicAuthorization }, signal: AbortSignal.timeout(4_000) }),
    ]);
    if (anonymousPage.status === 401 && protectedPage.ok) break;
  } catch (error) {
    lastError = error;
  }
  await delay(500);
}

if (!anonymousPage || anonymousPage.status !== 401) {
  console.error("O acesso sem senha nao foi bloqueado pelo encaminhador local.");
  process.exit(1);
}

if (!protectedPage?.ok) {
  console.error(`A autenticacao temporaria nao passou pela API local. ${lastError instanceof Error ? lastError.message : ""}`);
  process.exit(1);
}

const setCookie = protectedPage.headers.get("set-cookie") || "";
if (!setCookie.includes(`__Host-endocare-ngrok=${cookieToken};`)) {
  console.error("A autenticacao temporaria nao criou a sessao protegida do navegador.");
  process.exit(1);
}

const sessionResponse = await fetch(`${baseUrl}/api/health`, {
  headers: {
    authorization: "Bearer ngrok-session-check",
    cookie: `__Host-endocare-ngrok=${cookieToken}`,
  },
  signal: AbortSignal.timeout(5_000),
});
const health = await sessionResponse.json().catch(() => null);
if (!sessionResponse.ok || health?.status !== "ok" || health?.service !== "endobot") {
  console.error("O navegador nao pode usar o cookie de acesso junto da sessao da API.");
  process.exit(1);
}

console.log("Acesso anonimo bloqueado; credenciais temporarias e cookie de sessao verificados.");
