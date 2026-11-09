import * as v from "valibot";
import type { ParseResult } from "../../core/types";
import { parseJson } from "../../lib/parse-json";
import { TextEventSchema } from "./schema";

export function parse(rawBody: string): ParseResult {
  const raw = parseJson(rawBody);
  const result = v.safeParse(TextEventSchema, raw);
  if (!result.success) return { kind: "ignore" };

  const { message } = result.output;
  return {
    kind: "message",
    msg: {
      platform: "zalo",
      messageId: message.message_id,
      chatId: message.chat.id,
      chatType: "private",
      user: { id: message.from.id, name: message.from.display_name },
      text: message.text,
      raw,
    },
  };
}
