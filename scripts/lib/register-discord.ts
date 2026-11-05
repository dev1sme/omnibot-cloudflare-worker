import type { Command } from "../../src/core/types";

const API_BASE = "https://discord.com/api/v10";
const CHAT_INPUT = 1;

export interface RegisterDiscordEnv {
  DISCORD_APP_ID?: string;
  DISCORD_BOT_TOKEN?: string;
}

export function toDiscordCommands(commands: readonly Command[]) {
  return commands.map((c) => ({ name: c.name, description: c.description, type: CHAT_INPUT }));
}

// Overwrites every global command of the application, so removed commands disappear.
export async function registerDiscord(
  env: RegisterDiscordEnv,
  commands: readonly Command[],
  print: (line: string) => void,
): Promise<boolean> {
  if (!env.DISCORD_APP_ID || !env.DISCORD_BOT_TOKEN) {
    print("discord: skipped (no DISCORD_APP_ID or DISCORD_BOT_TOKEN)");
    return true;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/applications/${env.DISCORD_APP_ID}/commands`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toDiscordCommands(commands)),
    });
  } catch {
    print("discord: failed (network error)");
    return false;
  }

  if (!response.ok) {
    print(`discord: failed (HTTP ${response.status})`);
    return false;
  }
  print(`discord: registered ${commands.length} commands`);
  return true;
}
