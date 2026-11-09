import type { Env } from "../../core/types";
import { verifySecretHeader } from "../../lib/secret-equals";

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

export function verify(_rawBody: string, headers: Headers, env: Env): Promise<boolean> {
  return verifySecretHeader(headers, SECRET_HEADER, env.WEBHOOK_SECRET);
}
