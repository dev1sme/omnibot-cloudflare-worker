import { describe, expect, it } from "vitest";
import { ping } from "../../src/commands/ping";
import { commands } from "../../src/commands";
import { messages } from "../../src/messages";
import { createCtx, createEnv, createMessage } from "../helpers";

function deps(overrides: Parameters<typeof createEnv>[0] = {}, list = commands) {
  return { env: createEnv(overrides), ctx: createCtx().ctx, commands: list };
}

describe("/ping", () => {
  it("replies", async () => {
    expect(await ping.run(createMessage(), deps())).toEqual({ text: messages.pong });
  });
});
