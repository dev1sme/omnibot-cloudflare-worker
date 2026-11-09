import { describe, expect, it } from "vitest";
import { telegram } from "../../../src/adapters/telegram";
import { createEnv } from "../../helpers";

const TOKEN = "SECRET_TOKEN";
const env = createEnv({
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_BOT_USERNAME: "This_Bot",
  WEBHOOK_SECRET: "secret-value",
});

const update = (text: string, chatType = "private") =>
  JSON.stringify({
    update_id: 1,
    message: {
      message_id: 7,
      chat: { id: -100, type: chatType },
      from: { id: 42, first_name: "Ada" },
      text,
    },
  });

const parseText = (text: string) => {
  const result = telegram.parse(update(text), env);
  return result.kind === "message" ? result.msg.text : result.kind;
};

describe("parse", () => {
  it("maps the update to a message", () => {
    const result = telegram.parse(update("/ping", "supergroup"), env);
    expect(result).toMatchObject({
      kind: "message",
      msg: {
        platform: "telegram",
        messageId: "7",
        chatId: "-100",
        chatType: "group",
        user: { id: "42", name: "Ada" },
        text: "/ping",
      },
    });
  });

  it("marks private chats", () => {
    expect(telegram.parse(update("/ping"), env)).toMatchObject({ msg: { chatType: "private" } });
  });

  it("normalizes bot mentions", () => {
    expect(parseText("/ping")).toBe("/ping");
    expect(parseText("/ping@this_bot arg")).toBe("/ping arg");
    expect(parseText("/ping@other_bot")).toBe("ignore");
  });

  it("does not treat an email in plain text as a mention", () => {
    expect(parseText("mail a@b.c")).toBe("mail a@b.c");
  });

  it.each(["{", "{}", JSON.stringify({ edited_message: {} }), JSON.stringify({ message: { text: "x" } })])(
    "ignores %s",
    (body) => {
      expect(telegram.parse(body, env)).toEqual({ kind: "ignore" });
    },
  );
});
