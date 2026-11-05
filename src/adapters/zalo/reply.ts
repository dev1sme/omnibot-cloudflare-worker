import type { Env, IncomingMessage, OutgoingMessage } from "../../core/types";
import { PlatformError } from "../../lib/platform-error";
import { splitMessage } from "../../lib/split-message";
import { sendMessage } from "./client";

const MAX_TEXT_LENGTH = 2000;

// Does not retry 429: Zalo documents it as a quota error with no wait time.
export async function reply(
  msg: IncomingMessage,
  out: OutgoingMessage,
  env: Env,
): Promise<void> {
  if (!env.ZALO_BOT_TOKEN) throw new PlatformError("zalo");

  for (const chunk of splitMessage(out.text, MAX_TEXT_LENGTH)) {
    await sendMessage(env.ZALO_BOT_TOKEN, msg.chatId, chunk);
  }
}
