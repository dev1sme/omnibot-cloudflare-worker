import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdapter,
  createCommand,
  createCtx,
  createEnv,
  createMessage,
  createRequest,
} from "../../test/helpers";
import { PlatformError } from "../lib/platform-error";
import { messages } from "../messages";
import { handleWebhook } from "./pipeline";
import type { Command, OutgoingMessage } from "./types";

const ping = createCommand();

async function run(
  adapterOverrides: Parameters<typeof createAdapter>[0],
  commands: readonly Command[] = [ping],
  env = createEnv(),
) {
  const { ctx, settle } = createCtx();
  const res = await handleWebhook(createRequest(), createAdapter(adapterOverrides), commands, env, ctx);
  await settle();
  return res;
}

afterEach(() => vi.restoreAllMocks());

describe("HTTP behavior", () => {
  it("returns 404 for a disabled adapter", async () => {
    expect((await run({ isEnabled: () => false })).status).toBe(404);
  });

  it("returns 401 and does not parse when verification fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const parse = vi.fn();
    const res = await run({ verify: async () => false, parse });
    expect(res.status).toBe(401);
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns the envelope when parse ignores the payload", async () => {
    const reply = vi.fn();
    const res = await run({ parse: () => ({ kind: "ignore" }), reply });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(reply).not.toHaveBeenCalled();
  });

  it("returns the adapter response unchanged for respond", async () => {
    const response = Response.json({ type: 1 });
    expect(await run({ parse: () => ({ kind: "respond", response }) })).toBe(response);
  });

  it("returns the envelope and no reply for text that is not a command", async () => {
    const reply = vi.fn();
    const msg = createMessage({ text: "hello" });
    const res = await run({ parse: () => ({ kind: "message", msg }), reply });
    expect(await res.json()).toMatchObject({ success: true });
    expect(reply).not.toHaveBeenCalled();
  });

  it("passes the raw body to verify and parse", async () => {
    const verify = vi.fn(async () => true);
    const parse = vi.fn(() => ({ kind: "ignore" }) as const);
    const { ctx } = createCtx();
    await handleWebhook(createRequest("raw"), createAdapter({ verify, parse }), [], createEnv(), ctx);
    expect(verify.mock.calls[0]?.[0 as never]).toBe("raw");
    expect(parse.mock.calls[0]?.[0 as never]).toBe("raw");
  });
});

describe("execution", () => {
  it("acknowledges before the command finishes, then replies", async () => {
    let finish: (out: OutgoingMessage) => void = () => {};
    const slow = createCommand({ run: () => new Promise((resolve) => (finish = resolve)) });
    const reply = vi.fn(async () => {});
    const { ctx, settle } = createCtx();

    const res = await handleWebhook(createRequest(), createAdapter({ reply }), [slow], createEnv(), ctx);
    expect(await res.json()).toEqual({ acked: true });
    expect(reply).not.toHaveBeenCalled();

    finish({ text: "done" });
    await settle();
    expect(reply).toHaveBeenCalledWith(expect.anything(), { text: "done" }, expect.anything());
  });

  it("replies with a pointer to help for an unknown command", async () => {
    const reply = vi.fn(async () => {});
    await run({ reply }, []);
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { text: messages.unknownCommand },
      expect.anything(),
    );
  });

  it("logs without the error message and sends a generic reply when a command throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const reply = vi.fn(async () => {});
    const broken = createCommand({
      run: async () => {
        throw new Error("SECRET_DETAIL");
      },
    });
    const res = await run({ reply }, [broken]);

    expect(await res.json()).toEqual({ acked: true });
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { text: messages.commandFailed },
      expect.anything(),
    );
    expect(JSON.stringify(error.mock.calls)).toContain("command_failed");
    expect(JSON.stringify(error.mock.calls)).not.toContain("SECRET_DETAIL");
  });

  it("treats empty command text as a failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reply = vi.fn(async () => {});
    await run({ reply }, [createCommand({ run: async () => ({ text: "" }) })]);
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { text: messages.commandFailed },
      expect.anything(),
    );
  });

  it("does not reject when reply fails, and logs the status", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const reply = vi.fn(async () => {
      throw new PlatformError("test", { status: 500 });
    });
    await expect(run({ reply })).resolves.toBeInstanceOf(Response);
    expect(error.mock.calls[0]?.[0]).toMatchObject({ event: "reply_failed", status: 500 });
  });
});

describe("permissions", () => {
  const admin = createCommand({ permission: "admin" });

  it("denies a non-admin without running the command", async () => {
    const run_ = vi.fn(async () => ({ text: "secret" }));
    const reply = vi.fn(async () => {});
    await run({ reply }, [{ ...admin, run: run_ }]);
    expect(run_).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      { text: messages.permissionDenied },
      expect.anything(),
    );
  });

  it("runs the command for an admin", async () => {
    const reply = vi.fn(async () => {});
    await run({ reply }, [admin], createEnv({ ADMIN_USER_IDS: "test:u1" }));
    expect(reply).toHaveBeenCalledWith(expect.anything(), { text: "pong" }, expect.anything());
  });
});
