import { describe, expect, it } from "vitest";
import { discord } from "../../../src/adapters/discord";
import { createEnv, createMessage } from "../../helpers";

const baseEnv = createEnv({ DISCORD_APP_ID: "app1", DISCORD_PUBLIC_KEY: "00" });

describe("isEnabled", () => {
  it("needs the app id and public key, not the bot token", () => {
    expect(discord.isEnabled(baseEnv)).toBe(true);
    expect(discord.isEnabled({ ...baseEnv, DISCORD_APP_ID: undefined })).toBe(false);
    expect(discord.isEnabled({ ...baseEnv, DISCORD_PUBLIC_KEY: undefined })).toBe(false);
  });
});

describe("ack", () => {
  it("defers outside the envelope", async () => {
    expect(await discord.ack(createMessage()).json()).toEqual({ type: 5 });
  });
});
