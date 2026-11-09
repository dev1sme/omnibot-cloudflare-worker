import { describe, expect, it } from "vitest";
import { adapters } from "../../src/adapters";

describe("adapter registry", () => {
  it("registers the supported platforms", () => {
    expect(adapters.map((a) => a.name)).toEqual(["zalo", "telegram", "discord"]);
  });

  it("uses unique lowercase names that are valid in a path", () => {
    const names = adapters.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((name) => expect(name).toMatch(/^[a-z0-9-]+$/));
  });
});
