import { describe, expect, it } from "vitest";
import { zalo } from "../../../src/adapters/zalo";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({ ZALO_BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "secret-value" });

const event = (overrides: { event_name?: string; chat_type?: string } = {}) =>
  JSON.stringify({
    event_name: overrides.event_name ?? "message.text.received",
    message: {
      message_id: "m7",
      date: 1749632637199,
      message_type: "CHAT_TEXT",
      from: { id: "u42", display_name: "Ted", is_bot: false },
      chat: { id: "c9", chat_type: overrides.chat_type ?? "PRIVATE" },
      text: "/ping",
    },
  });

describe("parse", () => {
  it("maps a private text event", () => {
    expect(zalo.parse(event(), env)).toMatchObject({
      kind: "message",
      msg: {
        platform: "zalo",
        messageId: "m7",
        chatId: "c9",
        chatType: "private",
        user: { id: "u42", name: "Ted" },
        text: "/ping",
      },
    });
  });

  it.each([
    ["group chat", event({ chat_type: "GROUP" })],
    ["image event", event({ event_name: "message.image.received" })],
    ["unsupported event", event({ event_name: "message.unsupported.received" })],
    ["malformed JSON", "{"],
    ["empty object", "{}"],
  ])("ignores %s", (_, body) => {
    expect(zalo.parse(body, env)).toEqual({ kind: "ignore" });
  });
});
