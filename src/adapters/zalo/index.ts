import { ok } from "../../core/response";
import type { Adapter } from "../../core/types";
import { parse } from "./parse";
import { reply } from "./reply";
import { verify } from "./verify";

export const zalo: Adapter = {
  name: "zalo",
  isEnabled: (env) => Boolean(env.ZALO_BOT_TOKEN && env.WEBHOOK_SECRET),
  verify,
  parse,
  ack: () => ok(),
  reply,
};
