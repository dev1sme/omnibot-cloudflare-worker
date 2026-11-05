import { describe, expect, it } from "vitest";
import { isAdmin } from "../../src/lib/is-admin";

describe("isAdmin", () => {
  it("matches platform and user id", () => {
    expect(isAdmin("telegram", "1", "telegram:1, discord:2")).toBe(true);
    expect(isAdmin("discord", "2", "telegram:1, discord:2")).toBe(true);
  });

  it("does not match another platform, or a missing list", () => {
    expect(isAdmin("discord", "1", "telegram:1")).toBe(false);
    expect(isAdmin("telegram", "1", undefined)).toBe(false);
    expect(isAdmin("telegram", "1", "")).toBe(false);
  });
});
