# Architecture

omnibot is one Cloudflare Worker that serves several chat platforms. Command logic is written once. Platform differences stay inside adapters.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Entry point | `src/index.ts` | Match routes, run the pipeline, map outcomes to HTTP |
| Adapters | `src/adapters/` | Verify, parse, acknowledge, and reply for one platform |
| Router | `src/router.ts` | Resolve message text to a command |
| Commands | `src/commands/` | Platform-independent logic |
| Library | `src/lib/` | Shared helpers such as `splitMessage` and `secretEquals` |
| Scripts | `scripts/` | One-off setup tasks that run on a developer machine |

## Dependency rules

- Commands MUST NOT import from `src/adapters/`.
- Commands SHOULD NOT read `msg.raw` or branch on `msg.platform` for behavior. Displaying the platform name is fine.
- Adapters MUST NOT import from `src/commands/` or `src/router.ts`.
- The router MUST NOT import from `src/adapters/`.
- `src/lib/` MUST NOT import from any other layer.
- Worker code MUST NOT import from `scripts/`.

`src/index.ts` is the only module that connects adapters, the router, and commands.

## Directory layout

```
src/
├── index.ts              # Routes and pipeline
├── types.ts              # Contracts from contracts.md
├── router.ts             # Command resolution
├── adapters/
│   ├── index.ts          # Adapter list
│   ├── zalo.ts
│   ├── telegram.ts
│   └── discord.ts
├── commands/
│   ├── index.ts          # Command list
│   ├── ping.ts
│   └── help.ts
└── lib/
    ├── secret-equals.ts
    └── split-message.ts
scripts/
├── set-webhooks.ts
└── register-discord.ts
```

## Request lifecycle

```ts
async function handleWebhook(
  req: Request,
  adapter: Adapter,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!adapter.isEnabled(env)) return new Response(null, { status: 404 });

  // The body can be read only once, so the pipeline owns this read.
  const rawBody = await req.text();

  if (!(await adapter.verify(rawBody, req.headers, env))) {
    return new Response(null, { status: 401 });
  }

  const parsed = adapter.parse(rawBody, env);
  if (parsed.kind === "respond") return parsed.response;
  if (parsed.kind === "ignore") return Response.json({ ok: true });

  const route = resolve(parsed.msg.text, commands);
  if (route.kind === "none") return Response.json({ ok: true });

  ctx.waitUntil(execute(route, parsed.msg, adapter, env, ctx));
  return adapter.ack(parsed.msg);
}
```

The steps MUST stay in this order:

1. Check that the adapter is enabled.
2. Read the raw body once.
3. Verify the request. Nothing may parse the body before this step succeeds.
4. Parse the body into a `ParseResult`.
5. Resolve the command.
6. Schedule the work with `ctx.waitUntil()`.
7. Return the acknowledgement.

## Why every command runs in the background

Discord invalidates the interaction token if the first response takes more than 3 seconds. A command cannot promise to finish in that time, because it may call an external API.

All platforms therefore follow one path: acknowledge first, then run the command and send the reply in `ctx.waitUntil()`. The rule has one cost. Discord users briefly see a loading state, even for `/ping`.

## Execution

`execute` runs after the response has been returned, so nothing can catch its errors. It MUST NOT reject.

```ts
async function execute(route, msg, adapter, env, ctx) {
  let text: string;
  try {
    text = route.kind === "unknown"
      ? UNKNOWN_COMMAND_TEXT
      : await route.command.run(msg, { env, ctx });
  } catch (error) {
    logError("command_failed", msg, error);
    text = COMMAND_FAILED_TEXT;
  }

  try {
    await adapter.reply(msg, text, env);
  } catch (error) {
    logError("reply_failed", msg, error);
  }
}
```

`logError` MUST follow the logging rules in [security.md](security.md).

## Out of scope

- Long-polling and `getUpdates`. A Worker does not run continuously, and Zalo treats polling and webhooks as mutually exclusive.
- The Discord Gateway. Reading all channel messages needs a persistent WebSocket connection, which needs a separate server or Durable Objects.
- Personal Zalo accounts. omnibot uses only the official Zalo Bot Platform.
