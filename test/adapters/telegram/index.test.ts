import { describe, expect, it } from "vitest";
import { telegram } from "../../../src/adapters/telegram";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_BOT_USERNAME: "This_Bot",
  WEBHOOK_SECRET: "secret-value",
});

describe("isEnabled", () => {
  it("needs the token, username, and secret", () => {
    expect(telegram.isEnabled(env)).toBe(true);
    expect(telegram.isEnabled({ ...env, TELEGRAM_BOT_USERNAME: undefined })).toBe(false);
    expect(telegram.isEnabled({ ...env, WEBHOOK_SECRET: undefined })).toBe(false);
    expect(telegram.isEnabled({ ...env, TELEGRAM_BOT_TOKEN: undefined })).toBe(false);
  });
});
