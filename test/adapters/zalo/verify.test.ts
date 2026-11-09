import { describe, expect, it } from "vitest";
import { zalo } from "../../../src/adapters/zalo";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({ ZALO_BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "secret-value" });

describe("verify", () => {
  const verifyWith = (headers: Record<string, string>) => zalo.verify("{}", new Headers(headers), env);

  it("accepts the right secret", async () => {
    expect(await verifyWith({ "X-Bot-Api-Secret-Token": "secret-value" })).toBe(true);
  });

  it("rejects a wrong or missing secret", async () => {
    expect(await verifyWith({ "X-Bot-Api-Secret-Token": "wrong" })).toBe(false);
    expect(await verifyWith({})).toBe(false);
  });
});
