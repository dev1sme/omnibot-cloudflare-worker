import type { Adapter } from "../../core/types";
import { parse } from "./parse";
import { reply } from "./reply";
import { verify } from "./verify";

// Platform protocol response: must not use the envelope.
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5;

export const discord: Adapter = {
  name: "discord",
  isEnabled: (env) => Boolean(env.DISCORD_APP_ID && env.DISCORD_PUBLIC_KEY),
  verify,
  parse,
  ack: () => Response.json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE }),
  reply,
};
