import { verifyKey } from "discord-interactions";
import type { Env } from "../../core/types";

export async function verify(rawBody: string, headers: Headers, env: Env): Promise<boolean> {
  const signature = headers.get("X-Signature-Ed25519");
  const timestamp = headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) return false;

  return verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
}
