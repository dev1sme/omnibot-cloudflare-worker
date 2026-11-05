import { afterEach, describe, expect, it, vi } from "vitest";
import { createEnv, createMessage } from "../../../test/helpers";
import { PlatformError } from "../../lib/platform-error";
import { zalo } from "./index";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({ ZALO_BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "secret-value" });

const event = (overrides: { event_name?: string; chat_type?: string } = {}) =>
  JSON.stringify({
    event_name: overrides.event_name ?? "message.text.received",
    message: {
      message_id: "m7",
      date: 1749632637199,
      message_type: "CHAT_TEXT",
      from: { id: "u42", display_name: "Ted", is_bot: false },
      chat: { id: "c9", chat_type: overrides.chat_type ?? "PRIVATE" },
      text: "/ping",
    },
  });

afterEach(() => vi.unstubAllGlobals());

describe("isEnabled", () => {
  it("needs the token and secret", () => {
    expect(zalo.isEnabled(env)).toBe(true);
    expect(zalo.isEnabled({ ...env, ZALO_BOT_TOKEN: undefined })).toBe(false);
    expect(zalo.isEnabled({ ...env, WEBHOOK_SECRET: undefined })).toBe(false);
  });
});

describe("verify", () => {
  const verifyWith = (headers: Record<string, string>) => zalo.verify("{}", new Headers(headers), env);

  it("accepts the right secret", async () => {
    expect(await verifyWith({ "X-Bot-Api-Secret-Token": "secret-value" })).toBe(true);
  });

  it("rejects a wrong or missing secret", async () => {
    expect(await verifyWith({ "X-Bot-Api-Secret-Token": "wrong" })).toBe(false);
    expect(await verifyWith({})).toBe(false);
  });
});

describe("parse", () => {
  it("maps a private text event", () => {
    expect(zalo.parse(event(), env)).toMatchObject({
      kind: "message",
      msg: {
        platform: "zalo",
        messageId: "m7",
        chatId: "c9",
        chatType: "private",
        user: { id: "u42", name: "Ted" },
        text: "/ping",
      },
    });
  });

  it.each([
    ["group chat", event({ chat_type: "GROUP" })],
    ["image event", event({ event_name: "message.image.received" })],
    ["unsupported event", event({ event_name: "message.unsupported.received" })],
    ["malformed JSON", "{"],
    ["empty object", "{}"],
  ])("ignores %s", (_, body) => {
    expect(zalo.parse(body, env)).toEqual({ kind: "ignore" });
  });
});

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
