import http from "node:http";
import { timingSafeEqual } from "node:crypto";

const listenHost = "127.0.0.1";
const listenPort = Number(process.env.ENDOCARE_NGROK_GUARD_PORT || "5174");
const username = process.env.ENDOCARE_NGROK_USER;
const password = process.env.ENDOCARE_NGROK_PASSWORD;
const cookieToken = process.env.ENDOCARE_NGROK_COOKIE;
const cookieName = "__Host-endocare-ngrok";

if (!username || !password || !cookieToken || !Number.isInteger(listenPort) || listenPort < 1 || listenPort > 65535) {
  console.error("A autenticacao local do Ngrok nao foi configurada.");
  process.exit(1);
}

const expectedCredentials = Buffer.from(`${username}:${password}`, "utf8");
const expectedCookie = Buffer.from(cookieToken, "utf8");

function hasValidBasicCredentials(header) {
  if (typeof header !== "string" || !header.startsWith("Basic ")) return false;
  const actualCredentials = Buffer.from(header.slice("Basic ".length), "base64");
  return actualCredentials.length === expectedCredentials.length &&
    actualCredentials.length > 0 &&
    timingSafeEqual(actualCredentials, expectedCredentials);
}

function hasValidCookie(header) {
  if (typeof header !== "string") return false;
  const cookie = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return false;
  const actualCookie = Buffer.from(cookie.slice(cookieName.length + 1), "utf8");
  return actualCookie.length === expectedCookie.length &&
    actualCookie.length > 0 &&
    timingSafeEqual(actualCookie, expectedCookie);
}

function removeGuardCookie(header) {
  if (typeof header !== "string") return header;
  const retained = header.split(";").map((part) => part.trim()).filter((part) => !part.startsWith(`${cookieName}=`));
  return retained.length ? retained.join("; ") : undefined;
}

function accessCookie() {
  return `${cookieName}=${cookieToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

function unauthorized(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="EndoCare", charset="UTF-8"',
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end("Autenticacao necessaria.\n");
}

function upstreamHeaders(request) {
  const headers = { ...request.headers, host: "127.0.0.1:5173" };
  if (headers.authorization?.startsWith("Basic ")) delete headers.authorization;
  const retainedCookies = removeGuardCookie(headers.cookie);
  if (retainedCookies) headers.cookie = retainedCookies;
  else delete headers.cookie;
  return headers;
}

function denyUpgrade(clientSocket) {
  clientSocket.end('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="EndoCare"\r\nConnection: close\r\n\r\n');
}

const server = http.createServer((request, response) => {
  const hasBasicCredentials = hasValidBasicCredentials(request.headers.authorization);
  const hasCookie = hasValidCookie(request.headers.cookie);
  if (!hasBasicCredentials && !hasCookie) {
    const authType = typeof request.headers.authorization === "string" ? request.headers.authorization.split(" ", 1)[0] : "none";
    const cookieState = request.headers.cookie ? "invalid" : "none";
    console.warn(`[NgrokGuard] Acesso negado: auth=${authType}, cookie=${cookieState}.`);
    unauthorized(response);
    return;
  }
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: 5173,
    method: request.method,
    path: request.url,
    headers: upstreamHeaders(request),
  }, (upstreamResponse) => {
    const headers = { ...upstreamResponse.headers };
    if (hasBasicCredentials) {
      const upstreamCookies = headers["set-cookie"];
      headers["set-cookie"] = [...(Array.isArray(upstreamCookies) ? upstreamCookies : upstreamCookies ? [upstreamCookies] : []), accessCookie()];
    }
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, headers);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "Cache-Control": "no-store" });
    response.end("O frontend local nao respondeu.\n");
  });
  request.pipe(upstream);
});

server.on("upgrade", (request, clientSocket, head) => {
  const hasBasicCredentials = hasValidBasicCredentials(request.headers.authorization);
  if (!hasBasicCredentials && !hasValidCookie(request.headers.cookie)) {
    denyUpgrade(clientSocket);
    return;
  }

  const upstream = http.request({
    hostname: "127.0.0.1",
    port: 5173,
    method: request.method,
    path: request.url,
    headers: upstreamHeaders(request),
  });
  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    const statusText = response.statusMessage || "Switching Protocols";
    clientSocket.write(`HTTP/${response.httpVersion} ${response.statusCode} ${statusText}\r\n`);
    for (let index = 0; index < response.rawHeaders.length; index += 2) {
      clientSocket.write(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`);
    }
    clientSocket.write("\r\n");
    if (head.length) upstreamSocket.write(head);
    if (upstreamHead.length) clientSocket.write(upstreamHead);
    clientSocket.pipe(upstreamSocket).pipe(clientSocket);
  });
  upstream.on("response", (response) => {
    clientSocket.end(`HTTP/1.1 ${response.statusCode || 502} ${response.statusMessage || "Bad Gateway"}\r\nConnection: close\r\n\r\n`);
  });
  upstream.on("error", () => clientSocket.destroy());
  upstream.end();
});

server.listen(listenPort, listenHost, () => {
  console.log(`Protecao Ngrok ativa em http://${listenHost}:${listenPort}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
