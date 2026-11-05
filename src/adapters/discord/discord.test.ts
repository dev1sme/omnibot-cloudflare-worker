import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createEnv, createMessage } from "../../../test/helpers";
import { PlatformError } from "../../lib/platform-error";
import { discord } from "./index";

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

const INTERACTION_TOKEN = "SECRET_INTERACTION_TOKEN";
const raw = { token: INTERACTION_TOKEN };
const baseEnv = createEnv({ DISCORD_APP_ID: "app1", DISCORD_PUBLIC_KEY: "00" });

const interaction = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 2,
    id: "i1",
    token: INTERACTION_TOKEN,
    channel_id: "ch1",
    guild_id: "g1",
    member: { user: { id: "u1", username: "ada", global_name: "Ada" } },
    data: { name: "ping" },
    ...overrides,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("isEnabled", () => {
  it("needs the app id and public key, not the bot token", () => {
    expect(discord.isEnabled(baseEnv)).toBe(true);
    expect(discord.isEnabled({ ...baseEnv, DISCORD_APP_ID: undefined })).toBe(false);
    expect(discord.isEnabled({ ...baseEnv, DISCORD_PUBLIC_KEY: undefined })).toBe(false);
  });
});

describe("verify", () => {
  const body = '{"type":1}';
  const timestamp = "1793923200";
  let env = baseEnv;
  let signature = "";

  beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const publicKey = (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer;
    env = { ...baseEnv, DISCORD_PUBLIC_KEY: toHex(publicKey) };
    signature = toHex(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        pair.privateKey,
        new TextEncoder().encode(timestamp + body),
      ),
    );
  });

  const headers = (sig = signature, ts = timestamp) =>
    new Headers({ "X-Signature-Ed25519": sig, "X-Signature-Timestamp": ts });

  it("accepts a real signature in the Workers runtime", async () => {
    expect(await discord.verify(body, headers(), env)).toBe(true);
  });

  it("rejects a changed body or timestamp", async () => {
    expect(await discord.verify(`${body} `, headers(), env)).toBe(false);
    expect(await discord.verify(body, headers(signature, "1"), env)).toBe(false);
  });

  it("fails closed on missing or malformed input", async () => {
    expect(await discord.verify(body, new Headers(), env)).toBe(false);
    expect(await discord.verify(body, headers("not-hex"), env)).toBe(false);
    expect(await discord.verify(body, headers(), { ...env, DISCORD_PUBLIC_KEY: undefined })).toBe(false);
  });
});

describe("parse", () => {
  it("answers PING with PONG outside the envelope", async () => {
    const result = discord.parse('{"type":1}', baseEnv);
    if (result.kind !== "respond") throw new Error("Expected respond");
    expect(result.response.status).toBe(200);
    expect(result.response.headers.get("Content-Type")).toContain("application/json");
    expect(await result.response.json()).toEqual({ type: 1 });
  });

  it("maps a guild command", () => {
    expect(discord.parse(interaction(), baseEnv)).toMatchObject({
      kind: "message",
      msg: {
        platform: "discord",
        messageId: "i1",
        chatId: "ch1",
        chatType: "group",
        user: { id: "u1", name: "Ada" },
        text: "/ping",
      },
    });
  });

  it("maps a direct message command", () => {
    const body = interaction({
      guild_id: undefined,
      member: undefined,
      user: { id: "u2", username: "bob", global_name: null },
    });
    expect(discord.parse(body, baseEnv)).toMatchObject({
      msg: { chatType: "private", user: { id: "u2", name: "bob" } },
    });
  });

  it.each([
    ["component interaction", interaction({ type: 3 })],
    ["missing channel", interaction({ channel_id: undefined })],
    ["missing user", interaction({ member: undefined })],
    ["malformed JSON", "{"],
  ])("ignores %s", (_, body) => {
    expect(discord.parse(body, baseEnv)).toEqual({ kind: "ignore" });
  });
});

describe("ack", () => {
  it("defers outside the envelope", async () => {
    expect(await discord.ack(createMessage()).json()).toEqual({ type: 5 });
  });
});

describe("reply", () => {
  const webhook = `https://discord.com/api/v10/webhooks/app1/${INTERACTION_TOKEN}`;
  const success = () => Response.json({ id: "1" });

  function stubFetch(...responses: Response[]) {
    const mock = vi.fn(async (_url: string, _init: RequestInit) => success());
    responses.forEach((r) => mock.mockResolvedValueOnce(r));
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("edits the original message without mentions", async () => {
    const mock = stubFetch();
    await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv);

    const [url, init] = mock.mock.calls[0] ?? [];
    expect(url).toBe(`${webhook}/messages/@original`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ content: "hi", allowed_mentions: { parse: [] } });
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("sends other chunks as follow-ups", async () => {
    const mock = stubFetch();
    await discord.reply(createMessage({ raw }), { text: "a".repeat(2500) }, baseEnv);
    expect(mock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [`${webhook}/messages/@original`, "PATCH"],
      [webhook, "POST"],
    ]);
  });

  it("retries the first edit on 404", async () => {
    const mock = stubFetch(new Response(null, { status: 404 }));
    await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("stops after 3 attempts on 404", async () => {
    const mock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", mock);
    await expect(discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv)).rejects.toThrow(PlatformError);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("retries a rate limit using Retry-After", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mock = stubFetch(
      Response.json({ retry_after: 0 }, { status: 429, headers: { "Retry-After": "0" } }),
    );
    await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("falls back to retry_after in the body", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mock = stubFetch(Response.json({ retry_after: 0.001 }, { status: 429 }));
    await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("gives up when the wait exceeds the budget", async () => {
    const mock = stubFetch(Response.json({ retry_after: 60 }, { status: 429 }));
    const error = await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429 });
    expect(mock).toHaveBeenCalledOnce();
  });

  it("does not retry other errors, and keeps only the code", async () => {
    const mock = stubFetch(Response.json({ code: 50027, message: "Invalid Webhook Token" }, { status: 401 }));
    const error = await discord.reply(createMessage({ raw }), { text: "hi" }, baseEnv).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 401, errorCode: 50027 });
    expect(mock).toHaveBeenCalledOnce();
  });

  it("does not expose the token when the network fails", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      throw new Error(`failed: ${url}`);
    });
    const error = (await discord
      .reply(createMessage({ raw }), { text: "hi" }, baseEnv)
      .catch((e: unknown) => e)) as PlatformError;
    expect(error).toBeInstanceOf(PlatformError);
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(INTERACTION_TOKEN);
  });

  it("throws when the payload has no token", async () => {
    await expect(discord.reply(createMessage({ raw: {} }), { text: "hi" }, baseEnv)).rejects.toThrow(PlatformError);
  });
});
