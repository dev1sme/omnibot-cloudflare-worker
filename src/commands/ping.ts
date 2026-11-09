import type { Command } from "../core/types";
import { messages } from "../messages";

export const ping: Command = {
  name: "ping",
  description: "Kiểm tra bot còn hoạt động",
  async run() {
    return { text: messages.pong };
  },
};
