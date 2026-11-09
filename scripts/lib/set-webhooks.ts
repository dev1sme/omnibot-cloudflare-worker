const SECRET_FORMAT = /^[A-Za-z0-9_-]{8,256}$/;

export interface SetWebhooksEnv {
  WORKER_URL?: string;
  WEBHOOK_SECRET?: string;
  ZALO_BOT_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
}

type Print = (line: string) => void;

interface PlatformResult {
  ok?: boolean;
  description?: string;
  verification?: { outcome?: string };
  result?: { verification?: { outcome?: string } };
}

// Returns only the status and description. A fetch error can contain the token in its URL.
async function post(
  url: string,
  body: unknown,
): Promise<{ status: number; result: PlatformResult } | undefined> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as PlatformResult;
    return { status: response.status, result };
  } catch {
    return undefined;
  }
}

async function setTelegram(token: string, workerUrl: string, secret: string, print: Print) {
  const response = await post(`https://api.telegram.org/bot${token}/setWebhook`, {
    url: `${workerUrl}/webhook/telegram`,
    secret_token: secret,
    allowed_updates: ["message"],
  });
  if (!response) return report(print, "telegram", "network error");
  if (!response.result.ok) {
    return report(print, "telegram", `HTTP ${response.status} ${response.result.description ?? ""}`);
  }
  print("telegram: webhook set");
  return true;
}

async function setZalo(token: string, workerUrl: string, secret: string, print: Print) {
  const response = await post(`https://bot-api.zaloplatforms.com/bot${token}/setWebhook`, {
    url: `${workerUrl}/webhook/zalo`,
    secret_token: secret,
  });
  if (!response) return report(print, "zalo", "network error");
  if (!response.result.ok) {
    return report(print, "zalo", `HTTP ${response.status} ${response.result.description ?? ""}`);
  }

  // Zalo saves the URL even when its verification request fails.
  const outcome =
    response.result.result?.verification?.outcome ?? response.result.verification?.outcome;
  if (outcome !== "webhook.ok") return report(print, "zalo", `verification ${outcome ?? "missing"}`);

  print("zalo: webhook set");
  return true;
}

function report(print: Print, platform: string, reason: string): false {
  print(`${platform}: failed (${reason.trim()})`);
  return false;
}

export async function setWebhooks(env: SetWebhooksEnv, print: Print): Promise<boolean> {
  const workerUrl = env.WORKER_URL?.replace(/\/+$/, "");
  if (!workerUrl?.startsWith("https://")) {
    print("WORKER_URL must be an https URL");
    return false;
  }
  if (!env.WEBHOOK_SECRET || !SECRET_FORMAT.test(env.WEBHOOK_SECRET)) {
    print("WEBHOOK_SECRET must be 8-256 characters of A-Z, a-z, 0-9, _ or -");
    return false;
  }

  let succeeded = true;

  if (env.ZALO_BOT_TOKEN) {
    succeeded = (await setZalo(env.ZALO_BOT_TOKEN, workerUrl, env.WEBHOOK_SECRET, print)) && succeeded;
  } else {
    print("zalo: skipped (no ZALO_BOT_TOKEN)");
  }

  if (env.TELEGRAM_BOT_TOKEN) {
    succeeded =
      (await setTelegram(env.TELEGRAM_BOT_TOKEN, workerUrl, env.WEBHOOK_SECRET, print)) && succeeded;
  } else {
    print("telegram: skipped (no TELEGRAM_BOT_TOKEN)");
  }

  return succeeded;
}
