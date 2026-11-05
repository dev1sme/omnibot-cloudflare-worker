import { afterEach, describe, expect, it, vi } from "vitest";
import { createEnv, createMessage } from "../../../test/helpers";
import { PlatformError } from "../../lib/platform-error";
import { telegram } from "./index";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_BOT_USERNAME: "This_Bot",
  WEBHOOK_SECRET: "secret-value",
});

const update = (text: string, chatType = "private") =>
  JSON.stringify({
    update_id: 1,
    message: {
      message_id: 7,
      chat: { id: -100, type: chatType },
      from: { id: 42, first_name: "Ada" },
      text,
    },
  });

const parseText = (text: string) => {
  const result = telegram.parse(update(text), env);
  return result.kind === "message" ? result.msg.text : result.kind;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isEnabled", () => {
  it("needs the token, username, and secret", () => {
    expect(telegram.isEnabled(env)).toBe(true);
    expect(telegram.isEnabled({ ...env, TELEGRAM_BOT_USERNAME: undefined })).toBe(false);
    expect(telegram.isEnabled({ ...env, WEBHOOK_SECRET: undefined })).toBe(false);
    expect(telegram.isEnabled({ ...env, TELEGRAM_BOT_TOKEN: undefined })).toBe(false);
  });
});

describe("verify", () => {
  const verifyWith = (headers: Record<string, string>) =>
    telegram.verify("{}", new Headers(headers), env);

  it("accepts the right secret", async () => {
    expect(await verifyWith({ "X-Telegram-Bot-Api-Secret-Token": "secret-value" })).toBe(true);
  });

  it("rejects a wrong or missing secret", async () => {
    expect(await verifyWith({ "X-Telegram-Bot-Api-Secret-Token": "wrong" })).toBe(false);
    expect(await verifyWith({})).toBe(false);
  });
});

describe("parse", () => {
  it("maps the update to a message", () => {
    const result = telegram.parse(update("/ping", "supergroup"), env);
    expect(result).toMatchObject({
      kind: "message",
      msg: {
        platform: "telegram",
        messageId: "7",
        chatId: "-100",
        chatType: "group",
        user: { id: "42", name: "Ada" },
        text: "/ping",
      },
    });
  });

  it("marks private chats", () => {
    expect(telegram.parse(update("/ping"), env)).toMatchObject({ msg: { chatType: "private" } });
  });

  it("normalizes bot mentions", () => {
    expect(parseText("/ping")).toBe("/ping");
    expect(parseText("/ping@this_bot arg")).toBe("/ping arg");
    expect(parseText("/ping@other_bot")).toBe("ignore");
  });

  it("does not treat an email in plain text as a mention", () => {
    expect(parseText("mail a@b.c")).toBe("mail a@b.c");
  });

  it.each(["{", "{}", JSON.stringify({ edited_message: {} }), JSON.stringify({ message: { text: "x" } })])(
    "ignores %s",
    (body) => {
      expect(telegram.parse(body, env)).toEqual({ kind: "ignore" });
    },
  );
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
