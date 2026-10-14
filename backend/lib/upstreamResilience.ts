export class UpstreamTimeoutError extends Error {
  constructor(message = "upstream timeout") {
    super(message);
    this.name = "UpstreamTimeoutError";
  }
}

export function getBoundedTimeoutMs(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Keep the deadline active until the entire operation (including its response body) finishes.
export async function withAbortableTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  try {
    return await withTimeout(operation(controller.signal), timeoutMs);
  } finally {
    controller.abort();
  }
}

export function createTimedFetch(timeoutMs: number, fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init) => withAbortableTimeout(async (signal) => {
    const upstreamSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const result = await fetcher(input, {
      ...init,
      signal: upstreamSignal ? AbortSignal.any([signal, upstreamSignal]) : signal,
    });
    const body = result.body ? await result.arrayBuffer() : null;
    return new Response(body, { status: result.status, statusText: result.statusText, headers: result.headers });
  }, timeoutMs);
}

export class UpstreamCircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly failureThreshold = 3, private readonly cooldownMs = 30_000) {}

  get isOpen() {
    if (!this.openedAt) return false;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.openedAt = 0;
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = Date.now();
  }

  reset() {
    this.failures = 0;
    this.openedAt = 0;
  }
}
