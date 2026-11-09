import { describe, expect, it } from "vitest";
import { zalo } from "../../../src/adapters/zalo";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({ ZALO_BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "secret-value" });

describe("isEnabled", () => {
  it("needs the token and secret", () => {
    expect(zalo.isEnabled(env)).toBe(true);
    expect(zalo.isEnabled({ ...env, ZALO_BOT_TOKEN: undefined })).toBe(false);
    expect(zalo.isEnabled({ ...env, WEBHOOK_SECRET: undefined })).toBe(false);
  });
});
