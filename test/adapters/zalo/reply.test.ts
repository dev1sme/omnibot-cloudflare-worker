import { afterEach, describe, expect, it, vi } from "vitest";
import { zalo } from "../../../src/adapters/zalo";
import { PlatformError } from "../../../src/lib/platform-error";
import { createEnv, createMessage } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({ ZALO_BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "secret-value" });

afterEach(() => vi.unstubAllGlobals());

describe("reply", () => {
  const ok = () => Response.json({ ok: true, result: { message_id: "1" } });

  it("sends the request and splits at 2000", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ok());
    vi.stubGlobal("fetch", fetchMock);
    await zalo.reply(createMessage({ chatId: "c9" }), { text: "a".repeat(2500) }, env);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://bot-api.zaloplatforms.com/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: "c9", text: "a".repeat(2000) });
  });

  it("does not retry a quota error", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: false, error_code: 429 }, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await zalo.reply(createMessage(), { text: "hi" }, env).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, errorCode: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("treats ok false with HTTP 200 as a failure", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: false, error_code: 400 }));
    await expect(zalo.reply(createMessage(), { text: "hi" }, env)).rejects.toThrow(PlatformError);
  });

  it("treats a non-JSON response as a failure", async () => {
    vi.stubGlobal("fetch", async () => new Response("oops", { status: 502 }));
    const error = await zalo.reply(createMessage(), { text: "hi" }, env).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502 });
  });

  it("does not expose the token when the network fails", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      throw new Error(`failed: ${url}`);
    });
    const error = (await zalo
      .reply(createMessage(), { text: "hi" }, env)
      .catch((e: unknown) => e)) as PlatformError;
    expect(error).toBeInstanceOf(PlatformError);
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(TOKEN);
  });
});
