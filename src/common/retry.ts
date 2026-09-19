export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.attempts) {
        const jitter = Math.random() * opts.baseDelayMs;
        await delay(opts.baseDelayMs * 2 ** (attempt - 1) + jitter);
      }
    }
  }
  throw lastError;
}
