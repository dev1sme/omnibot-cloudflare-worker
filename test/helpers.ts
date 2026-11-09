import type { Adapter, Command, Env, IncomingMessage } from "../src/core/types";

export function createCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.all(pending) };
}

export function createEnv(overrides: Partial<Env> = {}): Env {
  return { OMNIBOT_KV: {} as KVNamespace, ...overrides };
}

export function createMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    platform: "test",
    messageId: "m1",
    chatId: "c1",
    chatType: "private",
    user: { id: "u1", name: "Ada" },
    text: "/ping",
    raw: {},
    ...overrides,
  };
}

export function createCommand(overrides: Partial<Command> = {}): Command {
  return {
    name: "ping",
    description: "Ping",
    run: async () => ({ text: "pong" }),
    ...overrides,
  };
}

export function createAdapter(overrides: Partial<Adapter> = {}): Adapter {
  return {
    name: "test",
    isEnabled: () => true,
    verify: async () => true,
    parse: () => ({ kind: "message", msg: createMessage() }),
    ack: () => Response.json({ acked: true }),
    reply: async () => {},
    ...overrides,
  };
}

export function createRequest(body = "{}"): Request {
  return new Request("https://omnibot.test/webhook/test", { method: "POST", body });
}
