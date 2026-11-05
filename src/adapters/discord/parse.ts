import * as v from "valibot";
import type { ParseResult } from "../../core/types";
import { parseJson } from "../../lib/parse-json";
import { CommandSchema, PingSchema } from "./schema";

// Platform protocol response: must not use the envelope.
const PONG = 1;

export function parse(rawBody: string): ParseResult {
  const raw = parseJson(rawBody);

  if (v.is(PingSchema, raw)) {
    return { kind: "respond", response: Response.json({ type: PONG }) };
  }

  const result = v.safeParse(CommandSchema, raw);
  if (!result.success) return { kind: "ignore" };

  const interaction = result.output;
  const user = interaction.member?.user ?? interaction.user;
  if (!user) return { kind: "ignore" };

  return {
    kind: "message",
    msg: {
      platform: "discord",
      messageId: interaction.id,
      chatId: interaction.channel_id,
      chatType: interaction.guild_id ? "group" : "private",
      user: { id: user.id, name: user.global_name ?? user.username },
      text: `/${interaction.data.name}`,
      raw,
    },
  };
}
