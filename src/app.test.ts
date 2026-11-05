import { describe, expect, it } from "vitest";
import { createCtx, createEnv } from "../test/helpers";
import { app } from "./app";

function request(path: string, method = "POST") {
  return app.fetch(new Request(`https://omnibot.test${path}`, { method }), createEnv(), createCtx().ctx);
}

describe("routes", () => {
  it("returns 404 for other paths", async () => {
    const res = await request("/other", "GET");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns 404 for an unknown platform with any method", async () => {
    expect((await request("/webhook/nope")).status).toBe(404);
    expect((await request("/webhook/constructor", "GET")).status).toBe(404);
  });
});
