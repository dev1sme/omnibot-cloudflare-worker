# Contracts

`src/types.ts` MUST implement these types. A change here is a change to every adapter and command, so update this document in the same pull request.

## Types

```ts
export interface Env {
  OMNIBOT_KV: KVNamespace;
  WEBHOOK_SECRET?: string;
  ZALO_BOT_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  DISCORD_APP_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
}

export interface IncomingMessage {
  platform: string;
  chatId: string;
  user: { id: string; name?: string };
  text: string;
  raw: unknown; // Original payload. Read by the owning adapter.
}

export type ParseResult =
  | { kind: "message"; msg: IncomingMessage }
  | { kind: "respond"; response: Response } // For example, Discord PING
  | { kind: "ignore" };

export interface Adapter {
  name: string;
  isEnabled(env: Env): boolean;
  verify(rawBody: string, headers: Headers, env: Env): Promise<boolean>;
  parse(rawBody: string, env: Env): ParseResult;
  ack(msg: IncomingMessage): Response;
  reply(msg: IncomingMessage, text: string, env: Env): Promise<void>;
}

export interface CommandDeps {
  env: Env;
  ctx: ExecutionContext;
}

export interface Command {
  name: string;
  description: string;
  run(msg: IncomingMessage, deps: CommandDeps): Promise<string>;
}

export type Route =
  | { kind: "command"; command: Command }
  | { kind: "unknown" } // Starts with "/" but matches no command
  | { kind: "none" }; // Not a command
```

## Adapter method rules

| Method | Rules |
| --- | --- |
| `name` | MUST be lowercase and equal the `/webhook/<name>` path segment and `msg.platform` |
| `isEnabled` | MUST return `false` if any secret the adapter needs is absent |
| `verify` | MUST return `false` on failure, including missing or malformed headers. MUST NOT throw |
| `parse` | MUST return `ignore` for malformed or unsupported payloads. MUST NOT throw |
| `ack` | MUST return without network calls |
| `reply` | MUST split long text, and MUST throw if the platform rejects the message |

## HTTP behavior

| Condition | Status | Body |
| --- | --- | --- |
| Path is not `/webhook/<known adapter>` | 404 | Empty |
| Method is not `POST` on a webhook path | 405 | Empty |
| Adapter is disabled | 404 | Empty |
| Verification fails | 401 | Empty |
| `parse` returns `ignore` | 200 | `{"ok":true}` |
| `parse` returns `respond` | Set by adapter | Set by adapter |
| Text is not a command | 200 | `{"ok":true}` |
| Command or unknown command accepted | From `ack` | From `ack` |
| Unexpected error before acknowledgement | 500 | Empty |

A failed command MUST NOT change the HTTP result, because the acknowledgement has already been sent.

## Delivery semantics

- Delivery is at-most-once after acknowledgement. Work that fails inside `waitUntil` is logged and is not retried.
- Duplicate deliveries remain possible. Telegram repeats a webhook after a non-2xx response, and Zalo documents no retry policy.
- omnibot has no global deduplication. KV is not suitable for it: changes can take 60 seconds or more to reach other locations, and the free tier allows 1,000 writes per day.
- A command with side effects MUST tolerate running twice. If it cannot, it needs a strongly consistent store such as Durable Objects or D1.
