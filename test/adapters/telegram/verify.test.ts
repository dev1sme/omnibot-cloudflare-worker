import { describe, expect, it } from "vitest";
import { telegram } from "../../../src/adapters/telegram";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_BOT_USERNAME: "This_Bot",
  WEBHOOK_SECRET: "secret-value",
});

describe("verify", () => {
  const verifyWith = (headers: Record<string, string>) =>
    telegram.verify("{}", new Headers(headers), env);

  it("accepts the right secret", async () => {
    expect(await verifyWith({ "X-Telegram-Bot-Api-Secret-Token": "secret-value" })).toBe(true);
  });

  it("rejects a wrong or missing secret", async () => {
    expect(await verifyWith({ "X-Telegram-Bot-Api-Secret-Token": "wrong" })).toBe(false);
    expect(await verifyWith({})).toBe(false);
  });
});
