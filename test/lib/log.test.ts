import { describe, expect, it } from "vitest";
import { errorFields } from "../../src/lib/log";
import { PlatformError } from "../../src/lib/platform-error";

describe("errorFields", () => {
  it("keeps only safe fields", () => {
    const fields = errorFields(new PlatformError("zalo", { status: 429, errorCode: 429 }));
    expect(fields).toEqual({ error_name: "PlatformError", status: 429, error_code: 429 });
  });

  it("drops the message of other errors", () => {
    const fields = errorFields(new Error("https://api.telegram.org/botTOKEN/sendMessage"));
    expect(JSON.stringify(fields)).not.toContain("TOKEN");
    expect(errorFields("text")).toEqual({ error_name: "UnknownError" });
  });
});
