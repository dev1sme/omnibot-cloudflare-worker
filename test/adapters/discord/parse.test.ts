import { describe, expect, it } from "vitest";
import { discord } from "../../../src/adapters/discord";
import { createEnv } from "../../helpers";

const INTERACTION_TOKEN = "SECRET_INTERACTION_TOKEN";
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
