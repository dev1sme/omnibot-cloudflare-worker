import { Api, GrammyError } from "grammy";
import type { Env, IncomingMessage, OutgoingMessage } from "../../core/types";
import { PlatformError } from "../../lib/platform-error";
import { createRetryBudget, retryOnRateLimit } from "../../lib/retry";
import { splitMessage } from "../../lib/split-message";

const PLATFORM = "telegram";
const MAX_TEXT_LENGTH = 4096;
const RATE_LIMITED = 429;

// Drops the original error, because a network error can contain the bot token in its URL.
function toPlatformError(error: unknown): PlatformError {
  if (!(error instanceof GrammyError)) return new PlatformError(PLATFORM);
  return new PlatformError(PLATFORM, {
    status: error.error_code,
    errorCode: error.error_code,
    retryAfterSeconds:
      error.error_code === RATE_LIMITED ? error.parameters.retry_after : undefined,
  });
}

export async function reply(
  msg: IncomingMessage,
  out: OutgoingMessage,
  env: Env,
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new PlatformError(PLATFORM);
  const api = new Api(env.TELEGRAM_BOT_TOKEN);
  const budget = createRetryBudget();

  for (const chunk of splitMessage(out.text, MAX_TEXT_LENGTH)) {
    await retryOnRateLimit(async () => {
      try {
        await api.sendMessage(msg.chatId, chunk);
      } catch (error) {
        throw toPlatformError(error);
      }
    }, budget);
  }
}
