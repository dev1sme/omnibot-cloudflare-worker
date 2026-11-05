import { afterEach, describe, expect, it, vi } from "vitest";
import { discord } from "../../../src/adapters/discord";
import { PlatformError } from "../../../src/lib/platform-error";
import { createEnv, createMessage } from "../../helpers";

const INTERACTION_TOKEN = "SECRET_INTERACTION_TOKEN";
const raw = { token: INTERACTION_TOKEN };
const baseEnv = createEnv({ DISCORD_APP_ID: "app1", DISCORD_PUBLIC_KEY: "00" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
