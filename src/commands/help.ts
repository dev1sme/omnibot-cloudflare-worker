import type { Command } from "../core/types";
import { isAdmin } from "../lib/is-admin";

export const help: Command = {
  name: "help",
  description: "Xem danh sách lệnh",
  async run(msg, { commands, env }) {
    const visible = commands.filter(
      (c) =>
        c.permission !== "admin" || isAdmin(msg.platform, msg.user.id, env.ADMIN_USER_IDS),
    );
    return { text: visible.map((c) => `/${c.name}: ${c.description}`).join("\n") };
  },
};
