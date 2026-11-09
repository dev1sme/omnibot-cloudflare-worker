import type { RESTPatchAPIWebhookWithTokenMessageJSONBody } from "discord-api-types/v10";
import * as v from "valibot";
import type { Env, IncomingMessage, OutgoingMessage } from "../../core/types";
import { PlatformError } from "../../lib/platform-error";
import { createRetryBudget, retryOnRateLimit, sleep, type RetryBudget } from "../../lib/retry";
import { splitMessage } from "../../lib/split-message";
import { ErrorCodeSchema, RateLimitSchema, ReplyTokenSchema } from "./schema";

const PLATFORM = "discord";
const API_BASE = "https://discord.com/api/v10";
const MAX_TEXT_LENGTH = 2000;
const RATE_LIMITED = 429;
const NOT_FOUND = 404;
const ORIGINAL_MAX_ATTEMPTS = 3;
const ORIGINAL_RETRY_DELAY_MS = 250;

function readRetryAfter(response: Response, body: unknown): number | undefined {
  if (response.status !== RATE_LIMITED) return undefined;
  const header = Number(response.headers.get("Retry-After") ?? Number.NaN);
  if (Number.isFinite(header) && header >= 0) return header;
  return v.is(RateLimitSchema, body) ? body.retry_after : undefined;
}

// Throws only PlatformError. The webhook URL contains the interaction token.
async function send(url: string, method: "PATCH" | "POST", content: string): Promise<void> {
  const body: RESTPatchAPIWebhookWithTokenMessageJSONBody = {
    content,
    allowed_mentions: { parse: [] },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PlatformError(PLATFORM);
  }
  if (response.ok) return;

  const error = await response.json().catch(() => undefined);
  throw new PlatformError(PLATFORM, {
    status: response.status,
    errorCode: v.is(ErrorCodeSchema, error) ? error.code : undefined,
    retryAfterSeconds: readRetryAfter(response, error),
  });
}

// waitUntil work can start before Discord has received the deferred acknowledgement.
async function editOriginal(url: string, content: string, budget: RetryBudget): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await retryOnRateLimit(() => send(url, "PATCH", content), budget);
    } catch (error) {
      const notReady = error instanceof PlatformError && error.status === NOT_FOUND;
      if (!notReady || attempt >= ORIGINAL_MAX_ATTEMPTS) throw error;
      await sleep(ORIGINAL_RETRY_DELAY_MS);
    }
  }
}

export async function reply(
  msg: IncomingMessage,
  out: OutgoingMessage,
  env: Env,
): Promise<void> {
  const interaction = v.safeParse(ReplyTokenSchema, msg.raw);
  if (!env.DISCORD_APP_ID || !interaction.success) throw new PlatformError(PLATFORM);

  const webhook = `${API_BASE}/webhooks/${env.DISCORD_APP_ID}/${interaction.output.token}`;
  const budget = createRetryBudget();
  const [first, ...rest] = splitMessage(out.text, MAX_TEXT_LENGTH);
  if (first === undefined) throw new PlatformError(PLATFORM);

  await editOriginal(`${webhook}/messages/@original`, first, budget);
  for (const chunk of rest) {
    await retryOnRateLimit(() => send(webhook, "POST", chunk), budget);
  }
}
