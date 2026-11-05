import { describe, expect, it, vi } from "vitest";
import { isAdmin } from "./is-admin";
import { errorFields } from "./log";
import { parseJson } from "./parse-json";
import { PlatformError } from "./platform-error";
import { createRetryBudget, retryOnRateLimit } from "./retry";
import { secretEquals, verifySecretHeader } from "./secret-equals";
import { splitMessage } from "./split-message";

describe("parseJson", () => {
  it("parses valid JSON and returns undefined otherwise", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson("{")).toBeUndefined();
  });
});

describe("secretEquals", () => {
  it("compares values, including different lengths", async () => {
    expect(await secretEquals("secret", "secret")).toBe(true);
    expect(await secretEquals("secret", "wrong")).toBe(false);
  });
});

describe("verifySecretHeader", () => {
  const headers = new Headers({ "X-Secret": "secret" });

  it("accepts a matching header", async () => {
    expect(await verifySecretHeader(headers, "X-Secret", "secret")).toBe(true);
  });

  it("fails closed", async () => {
    expect(await verifySecretHeader(headers, "X-Secret", "wrong")).toBe(false);
    expect(await verifySecretHeader(headers, "X-Other", "secret")).toBe(false);
    expect(await verifySecretHeader(headers, "X-Secret", undefined)).toBe(false);
  });
});

describe("splitMessage", () => {
  it("keeps text at the exact limit", () => {
    expect(splitMessage("abcde", 5)).toEqual(["abcde"]);
  });

  it("splits text one unit over the limit", () => {
    expect(splitMessage("abcdef", 5)).toEqual(["abcde", "f"]);
  });

  it("prefers a newline, then a space", () => {
    expect(splitMessage("aa bb\ncc dd", 8)).toEqual(["aa bb", "cc dd"]);
    expect(splitMessage("aa bb cc", 6)).toEqual(["aa bb", "cc"]);
  });

  it("never splits a surrogate pair", () => {
    const chunks = splitMessage("😀😀😀", 3);
    expect(chunks).toEqual(["😀", "😀", "😀"]);
  });

  it("makes progress when the limit is smaller than a surrogate pair", () => {
    expect(splitMessage("😀", 1).join("")).toBe("😀");
  });

  it("never returns an empty chunk or exceeds the limit", () => {
    const chunks = splitMessage(`${"a".repeat(10)}\n\n\n   \n${"b".repeat(10)}`, 10);
    expect(chunks).toEqual(["a".repeat(10), "b".repeat(10)]);
    expect(splitMessage("   ", 2)).toEqual([]);
    expect(splitMessage("", 2)).toEqual([]);
  });
});

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

describe("retryOnRateLimit", () => {
  const limited = (seconds?: number) =>
    new PlatformError("test", { status: 429, retryAfterSeconds: seconds });
  const wait = () => vi.fn(async () => {});

  it("waits for the stated time, then succeeds", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sleep = wait();
    const send = vi.fn().mockRejectedValueOnce(limited(2)).mockResolvedValue("sent");
    expect(await retryOnRateLimit(send, createRetryBudget(), sleep)).toBe("sent");
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stops after 2 retries", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(limited(1));
    await expect(retryOnRateLimit(send, createRetryBudget(), wait())).rejects.toThrow(PlatformError);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("stops when the wait exceeds the budget", async () => {
    const sleep = wait();
    const send = vi.fn().mockRejectedValue(limited(6));
    await expect(retryOnRateLimit(send, createRetryBudget(), sleep)).rejects.toThrow(PlatformError);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("shares one budget across sends", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const budget = createRetryBudget();
    await retryOnRateLimit(
      vi.fn().mockRejectedValueOnce(limited(4)).mockResolvedValue("a"),
      budget,
      wait(),
    );
    expect(budget.remainingMs).toBe(1000);
    await expect(
      retryOnRateLimit(vi.fn().mockRejectedValue(limited(2)), budget, wait()),
    ).rejects.toThrow(PlatformError);
  });

  it("does not retry other errors", async () => {
    const send = vi.fn().mockRejectedValue(new PlatformError("test", { status: 500 }));
    await expect(retryOnRateLimit(send, createRetryBudget(), wait())).rejects.toThrow(PlatformError);
    expect(send).toHaveBeenCalledOnce();
  });

  it("does not retry a 429 without a stated wait", async () => {
    const send = vi.fn().mockRejectedValue(limited());
    await expect(retryOnRateLimit(send, createRetryBudget(), wait())).rejects.toThrow(PlatformError);
    expect(send).toHaveBeenCalledOnce();
  });
});
