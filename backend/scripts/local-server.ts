import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir } from "node:fs/promises";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { warmKnowledgeCache } from "../lib/knowledge.js";
import { createTimedFetch } from "../lib/upstreamResilience.js";

const host = "127.0.0.1";
const port = 3000;
const apiDirectory = new URL("../api/", import.meta.url);
const routes = new Map((await readdir(apiDirectory))
  .filter((name) => /^[a-z0-9-]+\.ts$/.test(name))
  .map((name) => [`/api/${name.slice(0, -3)}`, new URL(name, apiDirectory).href]));
type Handler = (request: VercelRequest, response: VercelResponse) => unknown;
const handlers = new Map<string, Promise<Handler>>();

class RequestBodyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readBody(request: IncomingMessage) {
  const limit = 12 * 1024 * 1024;
  if (Number(request.headers["content-length"]) > limit) {
    throw new RequestBodyError(413, "A requisicao excede o limite de tamanho.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new RequestBodyError(413, "A requisicao excede o limite de tamanho.");
    chunks.push(Buffer.from(chunk));
  }
  if (!size) return {};
  if (!request.headers["content-type"]?.toLowerCase().includes("application/json")) {
    throw new RequestBodyError(415, "Envie uma requisicao JSON.");
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestBodyError(400, "A requisicao JSON e invalida."); }
}

function adaptResponse(response: ServerResponse): VercelResponse {
  const adapted = response as VercelResponse;
  adapted.status = (code) => { adapted.statusCode = code; return adapted; };
  adapted.json = (body) => {
    if (!adapted.writableEnded) {
      adapted.setHeader("Content-Type", "application/json; charset=utf-8");
      adapted.end(JSON.stringify(body));
    }
    return adapted;
  };
  adapted.send = (body) => { if (!adapted.writableEnded) adapted.end(body); return adapted; };
  return adapted;
}

const server = createServer(async (request, response) => {
  const started = Date.now();
  const adaptedResponse = adaptResponse(response);
  adaptedResponse.setHeader("Cache-Control", "no-store");
  adaptedResponse.setHeader("X-Content-Type-Options", "nosniff");
  let pathname = "/";
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    pathname = url.pathname.replace(/\/$/, "") || "/";
    const moduleUrl = routes.get(pathname);
    if (!moduleUrl) { adaptedResponse.status(404).json({ error: "Rota nao encontrada." }); return; }
    const query: Record<string, string | string[]> = {};
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key);
      query[key] = values.length === 1 ? values[0] : values;
    }
    const body = ["POST", "PUT", "PATCH"].includes(request.method || "") ? await readBody(request) : {};
    // This server is reached directly. Never trust a client-supplied forwarding address.
    request.headers["x-forwarded-for"] = request.socket.remoteAddress || "127.0.0.1";
    const adaptedRequest = Object.assign(request, { body, query, cookies: {} }) as VercelRequest;
    let handler = handlers.get(moduleUrl);
    if (!handler) {
      handler = import(moduleUrl).then((module) => {
        if (typeof module.default !== "function") throw new Error("Invalid API handler");
        return module.default as Handler;
      });
      handlers.set(moduleUrl, handler);
      handler.catch(() => handlers.delete(moduleUrl));
    }
    await (await handler)(adaptedRequest, adaptedResponse);
    if (!response.writableEnded) response.end();
  } catch (error) {
    if (!response.headersSent && !response.writableEnded) {
      if (error instanceof RequestBodyError) {
        adaptedResponse.setHeader("Connection", "close");
        adaptedResponse.status(error.status).json({ error: error.message });
      } else {
        console.error("[EndoCare] Falha no endpoint", pathname, error instanceof Error ? error.name : "unknown");
        adaptedResponse.status(503).json({ code: "server_unavailable", error: "Nao foi possivel atender agora. Tente novamente em instantes.", retryable: true });
      }
    } else if (!response.writableEnded) response.end();
  } finally {
    console.log(`[EndoCare] ${request.method} ${pathname} ${response.statusCode} ${Date.now() - started}ms`);
  }
});

server.requestTimeout = 180_000;
server.headersTimeout = 15_000;
server.once("error", (error: NodeJS.ErrnoException) => {
  console.error(error.code === "EADDRINUSE"
    ? "A porta 3000 ja esta em uso. O backend nao sera iniciado em outra porta."
    : `Nao foi possivel iniciar o backend: ${error.code || error.name}`);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`Backend EndoCare disponivel em http://${host}:${port}`);
  const projectUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (projectUrl && serviceRole) {
    const supabase = createClient(projectUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createTimedFetch(5_000) },
    });
    void warmKnowledgeCache(supabase, process.env.SUPABASE_KNOWLEDGE_BUCKET || "Knowledges")
      .then((index) => console.log(`[EndoCare] Acervo pronto: ${index.files.length} JSON, ${index.chunkCount} trechos.`))
      .catch(() => console.error("[EndoCare] O acervo ainda nao carregou. A proxima pergunta tentara novamente."));
  }
});
function shutdown() {
  server.closeAllConnections();
  server.close(() => { process.exitCode = 0; });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
