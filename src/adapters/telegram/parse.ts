import * as v from "valibot";
import type { Env, ParseResult } from "../../core/types";
import { parseJson } from "../../lib/parse-json";
import { UpdateSchema } from "./schema";

const COMMAND_WITH_MENTION = /^(\/[^\s@]+)@(\S+)(.*)$/s;

// Returns undefined when the command targets another bot.
function normalizeMention(text: string, username: string | undefined): string | undefined {
  const match = COMMAND_WITH_MENTION.exec(text);
  if (!match) return text;

  const [, command, mention, rest] = match;
  if (mention?.toLowerCase() !== username?.toLowerCase()) return undefined;
  return `${command}${rest}`;
}

export function parse(rawBody: string, env: Env): ParseResult {
  const raw = parseJson(rawBody);
  const result = v.safeParse(UpdateSchema, raw);
  if (!result.success) return { kind: "ignore" };

  const { message } = result.output;
  const text = normalizeMention(message.text, env.TELEGRAM_BOT_USERNAME);
  if (text === undefined) return { kind: "ignore" };

  return {
    kind: "message",
    msg: {
      platform: "telegram",
      messageId: String(message.message_id),
      chatId: String(message.chat.id),
      chatType: message.chat.type === "private" ? "private" : "group",
      user: { id: String(message.from.id), name: message.from.first_name },
      text,
      raw,
    },
  };
}
