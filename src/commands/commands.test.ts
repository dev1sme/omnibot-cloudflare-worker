import { describe, expect, it } from "vitest";
import { createCommand, createCtx, createEnv, createMessage } from "../../test/helpers";
import { messages } from "../messages";
import { help } from "./help";
import { commands } from "./index";
import { ping } from "./ping";

function deps(overrides: Parameters<typeof createEnv>[0] = {}, list = commands) {
  return { env: createEnv(overrides), ctx: createCtx().ctx, commands: list };
}

describe("command list", () => {
  it.each(commands.map((c) => [c.name, c] as const))("%s follows the naming rules", (_, command) => {
    expect(command.name).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(command.description.length).toBeGreaterThanOrEqual(1);
    expect(command.description.length).toBeLessThanOrEqual(100);
  });

  it("has unique names", () => {
    expect(new Set(commands.map((c) => c.name)).size).toBe(commands.length);
  });
});

describe("/ping", () => {
  it("replies", async () => {
    expect(await ping.run(createMessage(), deps())).toEqual({ text: messages.pong });
  });
});

describe("/help", () => {
  const list = [createCommand({ name: "open" }), createCommand({ name: "secret", permission: "admin" })];

  it("hides admin commands from other users", async () => {
    const { text } = await help.run(createMessage(), deps({}, list));
    expect(text).toContain("/open");
    expect(text).not.toContain("/secret");
  });

  it("shows admin commands to an admin", async () => {
    const { text } = await help.run(createMessage(), deps({ ADMIN_USER_IDS: "test:u1" }, list));
    expect(text).toContain("/secret");
  });
});
