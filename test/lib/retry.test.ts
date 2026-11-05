import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformError } from "../../src/lib/platform-error";
import { createRetryBudget, retryOnRateLimit } from "../../src/lib/retry";

afterEach(() => vi.restoreAllMocks());

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
