# Commands

A command is platform-independent logic that takes a message and returns reply text.

## Writing a command

Create `src/commands/hello.ts`:

```ts
import type { Command } from "../types";

export const hello: Command = {
  name: "hello",
  description: "Greet the user",
  async run(msg) {
    return `Hello ${msg.user.name ?? "there"} from ${msg.platform}!`;
  },
};
```

Register it in `src/commands/index.ts`:

```ts
import { hello } from "./hello";
export const commands = [ping, help, hello];
```

For Discord, run `npm run register-discord` so that the slash command appears.

## Naming rules

These rules are the portable subset of Discord's limits.

- `name` MUST match `^[a-z0-9_-]{1,32}$`.
- `name` MUST be unique.
- `description` MUST be 1 to 100 characters.

A test MUST check every registered command against these rules.

## Routing rules

`resolve(text, commands)` in `src/router.ts` works as follows.

| Input | Route |
| --- | --- |
| `hello` | `none`: no reply |
| `/hello` or `/hello world` | `command` |
| `/HELLO` | `command`: names match case-insensitively |
| `/missing` | `unknown`: replies with a pointer to `/help` |

The router MUST NOT trim platform-specific syntax. Adapters normalize that text during parsing, such as Telegram's `/ping@this_bot`.

Replying to `unknown` is deliberate. A stale Discord command would otherwise stay in its loading state. The cost is a possible extra reply in Telegram groups that use several bots.

## Arguments

A command reads arguments by parsing `msg.text`. Text after the command name is available on Telegram and Zalo. Discord commands take no options yet, so a command MUST work or reply with usage text when arguments are absent.

## Runtime rules

- `run` executes inside `ctx.waitUntil()`, after the platform has been acknowledged.
- All `waitUntil` work in a request shares a 30-second limit, and pending promises are canceled after it. An external call MUST set a timeout that leaves room for the reply:

  ```ts
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  ```

- A failed command SHOULD throw. The pipeline logs the error and sends a generic reply.
- `run` MUST NOT return text containing a secret, or error details from an internal system.
- Return text without platform-specific formatting.
- Commands with side effects MUST tolerate duplicate delivery. See [contracts.md](contracts.md).

## State

Use `deps.env.OMNIBOT_KV` for data that is read often and written rarely.

```ts
async run(msg, { env }) {
  const key = `user:${msg.platform}:${msg.user.id}:lang`;
  const lang = await env.OMNIBOT_KV.get(key);
  return lang ? `Language: ${lang}` : "No language set";
}
```

- Keys MUST include `msg.platform`, because IDs are unique only within one platform.
- Keys follow `<entity>:<platform>:<id>[:<field>]`.
- MUST NOT use KV for counters, locks, or read-after-write logic. It is eventually consistent and allows one write per second per key.
