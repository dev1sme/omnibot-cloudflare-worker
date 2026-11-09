import type { Command, Route } from "./types";

export function resolve(text: string, commands: readonly Command[]): Route {
  if (!text.startsWith("/")) return { kind: "none" };

  const name = text.slice(1).split(/\s/, 1)[0]?.toLowerCase();
  const command = commands.find((c) => c.name === name);
  return command ? { kind: "command", command } : { kind: "unknown" };
}
