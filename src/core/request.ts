export type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function createRequestSignal({
  signal,
  timeoutMs,
}: RequestOptions) {
  if (timeoutMs === undefined) {
    return signal
      ? {
          dispose: () => {},
          signal,
        }
      : undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  const abort = () => {
    controller.abort(signal?.reason);
  };

  if (signal?.aborted) {
    clearTimeout(timeout);
    abort();
  } else {
    signal?.addEventListener("abort", abort, {
      once: true,
    });
  }

  return {
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
    signal: controller.signal,
  };
}
