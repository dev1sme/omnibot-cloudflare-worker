import * as v from "valibot";
import { PlatformError } from "../../lib/platform-error";
import { ApiResponseSchema } from "./schema";

const PLATFORM = "zalo";
const API_BASE = "https://bot-api.zaloplatforms.com";

export async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // Drops the original error, because it can contain the token in its URL.
    throw new PlatformError(PLATFORM);
  }

  const body = v.safeParse(ApiResponseSchema, await response.json().catch(() => undefined));
  if (!response.ok || !body.success || !body.output.ok) {
    throw new PlatformError(PLATFORM, {
      status: response.status,
      errorCode: body.success ? body.output.error_code : undefined,
    });
  }
}
