import { describe, expect, it } from "vitest";
import { commands } from "../../src/commands";

describe("command list", () => {
  it.each(commands.map((c) => [c.name, c] as const))("%s follows the naming rules", (_, command) => {
    expect(command.name).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(command.description.length).toBeGreaterThanOrEqual(1);
    expect(command.description.length).toBeLessThanOrEqual(100);
  });

  it("has unique names", () => {
    expect(new Set(commands.map((c) => c.name)).size).toBe(commands.length);
  });
});
