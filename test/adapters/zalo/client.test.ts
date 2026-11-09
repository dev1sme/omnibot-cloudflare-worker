import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "../../../src/adapters/zalo/client";
import { PlatformError } from "../../../src/lib/platform-error";

const TOKEN = "SECRET_TOKEN";

afterEach(() => vi.unstubAllGlobals());

describe("sendMessage", () => {
  it("posts JSON to the bot URL", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await sendMessage(TOKEN, "c1", "hi");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://bot-api.zaloplatforms.com/bot${TOKEN}/sendMessage`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: "c1", text: "hi" });
  });

  it("reports the status and error code", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: false, error_code: 400 }, { status: 400 }));
    const error = await sendMessage(TOKEN, "c1", "hi").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlatformError);
    expect(error).toMatchObject({ platform: "zalo", status: 400, errorCode: 400 });
  });

  it("treats ok false with HTTP 200 as a failure", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: false, error_code: 7 }));
    await expect(sendMessage(TOKEN, "c1", "hi")).rejects.toMatchObject({ status: 200, errorCode: 7 });
  });

  it("treats a response that is not JSON as a failure", async () => {
    vi.stubGlobal("fetch", async () => new Response("oops", { status: 502 }));
    await expect(sendMessage(TOKEN, "c1", "hi")).rejects.toMatchObject({ status: 502 });
  });

  it("never sets a wait time, so a quota error is not retried", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: false, error_code: 429 }, { status: 429 }));
    const error = (await sendMessage(TOKEN, "c1", "hi").catch((e: unknown) => e)) as PlatformError;
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it("drops a network error that contains the token", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      throw new Error(`failed: ${url}`);
    });
    const error = (await sendMessage(TOKEN, "c1", "hi").catch((e: unknown) => e)) as PlatformError;
    expect(error).toBeInstanceOf(PlatformError);
    expect(JSON.stringify({ ...error, message: error.message, stack: error.stack })).not.toContain(TOKEN);
  });
});
