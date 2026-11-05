import { ok } from "../../core/response";
import type { Adapter } from "../../core/types";
import { parse } from "./parse";
import { reply } from "./reply";
import { verify } from "./verify";

export const telegram: Adapter = {
  name: "telegram",
  isEnabled: (env) =>
    Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_USERNAME && env.WEBHOOK_SECRET),
  verify,
  parse,
  ack: () => ok(),
  reply,
};
