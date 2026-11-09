import { afterEach, describe, expect, it, vi } from "vitest";
import { telegram } from "../../../src/adapters/telegram";
import { PlatformError } from "../../../src/lib/platform-error";
import { createEnv, createMessage } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_BOT_USERNAME: "This_Bot",
  WEBHOOK_SECRET: "secret-value",
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reply", () => {
  const ok = () => Response.json({ ok: true, result: { message_id: 1 } });

  it("sends plain text to the chat", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ok());
    vi.stubGlobal("fetch", fetchMock);
    await telegram.reply(createMessage({ chatId: "5" }), { text: "hi" }, env);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain("/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: "5", text: "hi" });
  });

  it("splits long text", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ok());
    vi.stubGlobal("fetch", fetchMock);
    await telegram.reply(createMessage(), { text: "a".repeat(5000) }, env);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a rate limit and resends only the failed chunk", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const limited = Response.json({
      ok: false,
      error_code: 429,
      description: "Too Many Requests",
      parameters: { retry_after: 0 },
    });
    const fetchMock = vi
      .fn(async (_url: string, _init: RequestInit) => ok())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(limited);
    vi.stubGlobal("fetch", fetchMock);

    await telegram.reply(createMessage(), { text: "a".repeat(5000) }, env);
    const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)).text.length);
    expect(sent).toEqual([4096, 904, 904]);
  });

  it("throws a safe error when Telegram rejects the message", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ok: false, error_code: 400, description: "Bad Request" }),
    );
    const error = await telegram.reply(createMessage(), { text: "hi" }, env).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlatformError);
    expect(error).toMatchObject({ status: 400, errorCode: 400 });
  });

  it("does not expose the token when the network fails", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      throw new Error(`failed: ${url}`);
    });
    const error = (await telegram
      .reply(createMessage(), { text: "hi" }, env)
      .catch((e: unknown) => e)) as PlatformError;
    expect(error).toBeInstanceOf(PlatformError);
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(TOKEN);
    expect(error.cause).toBeUndefined();
  });
});
