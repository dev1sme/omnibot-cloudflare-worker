import { describe, expect, it } from "vitest";
import { help } from "../../src/commands/help";
import { commands } from "../../src/commands";
import { createCommand, createCtx, createEnv, createMessage } from "../helpers";

function deps(overrides: Parameters<typeof createEnv>[0] = {}, list = commands) {
  return { env: createEnv(overrides), ctx: createCtx().ctx, commands: list };
}

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
