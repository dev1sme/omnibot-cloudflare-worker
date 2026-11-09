import { afterEach, describe, expect, it, vi } from "vitest";
import { setWebhooks } from "../../../scripts/lib/set-webhooks";

const TOKEN = "SECRET_TOKEN";
const base = { WORKER_URL: "https://bot.example/", WEBHOOK_SECRET: "secret-value" };

function capture() {
  const lines: string[] = [];
  return { lines, print: (line: string) => void lines.push(line) };
}

afterEach(() => vi.unstubAllGlobals());

describe("setWebhooks", () => {
  it("rejects a bad URL or secret before calling any API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { print } = capture();
    expect(await setWebhooks({ ...base, WORKER_URL: "http://x" }, print)).toBe(false);
    expect(await setWebhooks({ ...base, WEBHOOK_SECRET: "has space!" }, print)).toBe(false);
    expect(await setWebhooks({ ...base, WEBHOOK_SECRET: "short" }, print)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips a platform without a token", async () => {
    const { lines, print } = capture();
    expect(await setWebhooks(base, print)).toBe(true);
    expect(lines).toEqual(["zalo: skipped (no ZALO_BOT_TOKEN)", "telegram: skipped (no TELEGRAM_BOT_TOKEN)"]);
  });

  it("registers Telegram with the secret and message updates", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await setWebhooks({ ...base, TELEGRAM_BOT_TOKEN: TOKEN }, capture().print)).toBe(true);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body))).toEqual({
      url: "https://bot.example/webhook/telegram",
      secret_token: "secret-value",
      allowed_updates: ["message"],
    });
  });

  it.each([
    [{ ok: true, result: { verification: { outcome: "webhook.ok" } } }, true],
    [{ ok: true, verification: { outcome: "webhook.ok" } }, true],
    [{ ok: true, result: { verification: { outcome: "webhook.timeout" } } }, false],
    [{ ok: true }, false],
    [{ ok: false, description: "Bad" }, false],
  ])("checks the Zalo result %j", async (body, expected) => {
    vi.stubGlobal("fetch", async () => Response.json(body));
    expect(await setWebhooks({ ...base, ZALO_BOT_TOKEN: TOKEN }, capture().print)).toBe(expected);
  });

  it("never prints a secret, including on a network failure", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      throw new Error(`failed: ${url}`);
    });
    const { lines, print } = capture();
    expect(await setWebhooks({ ...base, TELEGRAM_BOT_TOKEN: TOKEN, ZALO_BOT_TOKEN: TOKEN }, print)).toBe(false);
    expect(lines.join()).not.toContain(TOKEN);
    expect(lines.join()).not.toContain("secret-value");
  });
});
