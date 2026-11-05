import { log } from "./log";
import { PlatformError } from "./platform-error";

const MAX_RETRIES = 2;
const MAX_TOTAL_WAIT_MS = 5_000;

export interface RetryBudget {
  remainingMs: number;
}

export function createRetryBudget(): RetryBudget {
  return { remainingMs: MAX_TOTAL_WAIT_MS };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries only a rate limit with a stated wait time. Share one budget across a reply.
export async function retryOnRateLimit<T>(
  send: () => Promise<T>,
  budget: RetryBudget,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (!(error instanceof PlatformError) || error.retryAfterSeconds === undefined) throw error;
      const waitMs = error.retryAfterSeconds * 1000;
      if (attempt >= MAX_RETRIES || waitMs > budget.remainingMs) throw error;

      budget.remainingMs -= waitMs;
      log.warn("reply_rate_limited", { platform: error.platform, status: error.status });
      await wait(waitMs);
    }
  }
}
