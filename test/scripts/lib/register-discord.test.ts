import { afterEach, describe, expect, it, vi } from "vitest";
import { registerDiscord } from "../../../scripts/lib/register-discord";
import { createCommand } from "../../helpers";

const TOKEN = "SECRET_TOKEN";

function capture() {
  const lines: string[] = [];
  return { lines, print: (line: string) => void lines.push(line) };
}

afterEach(() => vi.unstubAllGlobals());

describe("registerDiscord", () => {
  const env = { DISCORD_APP_ID: "app1", DISCORD_BOT_TOKEN: TOKEN };
  const commands = [createCommand({ name: "ping", description: "Ping" })];

  it("skips without credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await registerDiscord({}, commands, capture().print)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("overwrites the global list with bot auth", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await registerDiscord(env, commands, capture().print)).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://discord.com/api/v10/applications/app1/commands");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bot ${TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual([{ name: "ping", description: "Ping", type: 1 }]);
  });

  it("reports failure without exposing the token", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));
    const { lines, print } = capture();
    expect(await registerDiscord(env, commands, print)).toBe(false);
    expect(lines.join()).toBe("discord: failed (HTTP 401)");
  });
});
