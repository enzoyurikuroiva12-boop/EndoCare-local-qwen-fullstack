export class EndoBotApiError extends Error {
  constructor(message: string, public status = 0, public code = "request_failed", public retryable = true) {
    super(message);
    this.name = "EndoBotApiError";
  }
}

export async function requestEndoBot<T>(url: string, init: RequestInit, timeoutMs = 90_000): Promise<T> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const result = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error;
      return null;
    });
    if (!response.ok) {
      throw new EndoBotApiError(
        typeof result?.error === "string" ? result.error : "Não foi possível atender agora. Tente novamente.",
        response.status,
        typeof result?.code === "string" ? result.code : `http_${response.status}`,
        result?.retryable !== false && (response.status === 429 || response.status >= 500),
      );
    }
    if (result === null) throw new EndoBotApiError("O servidor enviou uma resposta inválida.", response.status, "invalid_response");
    return result as T;
  } catch (error) {
    if (timedOut) throw new EndoBotApiError("A resposta demorou mais que o esperado. Tente novamente.", 0, "request_timeout");
    if (error instanceof EndoBotApiError) throw error;
    if (externalSignal?.aborted) throw error;
    throw new EndoBotApiError("Não foi possível conectar ao EndoBot. Confira se o backend local está iniciado.", 0, "network_error");
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}
