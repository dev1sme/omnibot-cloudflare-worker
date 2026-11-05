import { describe, expect, it } from "vitest";
import { secretEquals, verifySecretHeader } from "../../src/lib/secret-equals";

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
