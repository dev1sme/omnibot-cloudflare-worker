import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { createCtx, createEnv } from "./helpers";

const env = createEnv({
  WEBHOOK_SECRET: "secret-value",
  TELEGRAM_BOT_TOKEN: "TOKEN",
  TELEGRAM_BOT_USERNAME: "this_bot",
});

const update = JSON.stringify({
  message: {
    message_id: 1,
    chat: { id: 5, type: "private" },
    from: { id: 2, first_name: "Ada" },
    text: "/ping",
  },
});

function post(path: string, headers: Record<string, string> = {}) {
  const { ctx, settle } = createCtx();
  const req = new Request(`https://omnibot.test${path}`, { method: "POST", headers, body: update });
  return { res: app.fetch(req, env, ctx), settle };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /webhook/telegram", () => {
  it("acknowledges, then sends the reply", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ ok: true, result: { message_id: 1 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { res, settle } = post("/webhook/telegram", {
      "X-Telegram-Bot-Api-Secret-Token": "secret-value",
    });
    const response = await res;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: null });

    await settle();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body))).toMatchObject({ chat_id: "5" });
  });

  it("rejects a wrong secret and sends nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { res, settle } = post("/webhook/telegram", {
      "X-Telegram-Bot-Api-Secret-Token": "wrong",
    });
    const response = await res;
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("disabled and unsupported routes", () => {
  it("returns 404 for a platform without configuration", async () => {
    expect((await post("/webhook/discord").res).status).toBe(404);
  });

  it("returns 405 for another method on a known platform", async () => {
    const { ctx } = createCtx();
    const res = await app.fetch(new Request("https://omnibot.test/webhook/telegram"), env, ctx);
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED" } });
  });
});
