import { describe, expect, it } from "vitest";
import { PlatformError } from "../../src/lib/platform-error";

describe("PlatformError", () => {
  it("keeps the platform and safe details", () => {
    const error = new PlatformError("telegram", { status: 429, errorCode: 429, retryAfterSeconds: 2 });
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "PlatformError",
      platform: "telegram",
      status: 429,
      errorCode: 429,
      retryAfterSeconds: 2,
    });
  });

  it("uses a fixed message and no cause", () => {
    const error = new PlatformError("zalo");
    expect(error.message).toBe("Platform request failed");
    expect(error.cause).toBeUndefined();
    expect(error.status).toBeUndefined();
    expect(error.retryAfterSeconds).toBeUndefined();
  });
});
