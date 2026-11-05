import { describe, expect, it } from "vitest";
import { fail, ok } from "../../src/core/response";

describe("ok", () => {
  it("wraps data in the success envelope", async () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toMatchObject({ success: true, message: "OK", data: { id: 1 } });
    expect(body.meta).toEqual({ timestamp: expect.any(Number) });
  });

  it("uses null data by default", async () => {
    expect((await ok().json<{ data: unknown }>()).data).toBeNull();
  });
});

describe("fail", () => {
  it.each([
    ["UNAUTHORIZED", 401],
    ["NOT_FOUND", 404],
    ["METHOD_NOT_ALLOWED", 405],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s to %i", async (code, status) => {
    const res = fail(code);
    expect(res.status).toBe(status);
    const body = await res.json<Record<string, unknown>>();
    expect(body).toMatchObject({ success: false, error: { code } });
    expect(body).not.toHaveProperty("status");
  });
});
