# omnibot

One Cloudflare Worker that runs chat bots on Zalo, Telegram, and Discord.

The standards in `docs/` are mandatory. Start with `docs/README.md`, which explains the rule keywords and which document wins in a conflict.

## Read before changing

| Task | Read |
| --- | --- |
| Pipeline, routes, or types | `docs/architecture.md`, `docs/contracts.md` |
| Adapter or new platform | `docs/adapters.md`, `docs/security.md` |
| Command | `docs/commands.md` |
| Deployment, secrets, or scripts | `docs/operations.md`, `docs/security.md` |
| Any code | `docs/conventions.md` |

## Rules that are easy to break

- Read the request body once in the pipeline. Verify it before parsing.
- Commands must not import adapters.
- Acknowledge first, then run commands inside `ctx.waitUntil()`.
- Never log platform API URLs. Zalo and Telegram URLs contain the bot token.
- Do not use KV for deduplication, counters, or locks.
- If code and `docs/` disagree, fix one of them in the same change, and update the status table in `docs/README.md`.

## Commands

```bash
npm run dev
npm run lint
npm test
```
