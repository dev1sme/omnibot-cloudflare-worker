# omnibot engineering standards

These documents define how omnibot must be built. Code, reviews, and AI agents follow them.

The repository has no implementation yet, so these documents are a specification written ahead of the code.

## Documents

| Document | Scope |
| --- | --- |
| [architecture.md](architecture.md) | Layers, dependency rules, request lifecycle |
| [contracts.md](contracts.md) | Shared types, HTTP behavior, delivery semantics |
| [adapters.md](adapters.md) | Per-platform requirements, adding a platform |
| [commands.md](commands.md) | Writing and registering commands |
| [security.md](security.md) | Webhook verification, secrets, logging |
| [operations.md](operations.md) | Setup, deployment, local development, platform limits |
| [conventions.md](conventions.md) | Code style, testing, commits, Definition of Done |

## Reading the rules

- **MUST** and **MUST NOT** are mandatory. A deviation requires changing the document first.
- **SHOULD** is the default. A deviation needs a stated reason in the pull request.
- **MAY** is optional.

## Source of truth

1. If documents disagree, `contracts.md` wins on types and HTTP behavior. `security.md` wins on security.
2. These documents win over the root `README.md`, which is only an introduction and quick start.
3. If code and documents disagree, treat it as a defect. Fix the code, or change the document in the same pull request.

## Status

Update this table in the pull request that changes a component's status.

| Component | Status |
| --- | --- |
| Worker entry point and pipeline | Planned |
| Command router | Planned |
| `/ping`, `/help` | Planned |
| Zalo adapter | Planned |
| Telegram adapter | Planned |
| Discord adapter (slash commands) | Planned |
| `set-webhooks`, `register-discord` scripts | Planned |

## External facts

Platform facts were checked against official documentation on 2026-11-05. Platforms change, so recheck a fact before relying on it for new work.

| Platform | Reference |
| --- | --- |
| Zalo | <https://bot.zaloplatforms.com/docs/> |
| Telegram | <https://core.telegram.org/bots/api> |
| Discord | <https://docs.discord.com/developers/interactions/overview> |
| Cloudflare Workers | <https://developers.cloudflare.com/workers/platform/limits/> |
| Cloudflare KV | <https://developers.cloudflare.com/kv/platform/limits/> |

These items remain unconfirmed. Confirm each one during implementation, then remove it from this list.

- Zalo does not document a webhook retry policy, a response deadline, or a `secret_token` character set.
- Zalo does not state whether `sendMessage` works in group chats.
- Discord's interaction pages do not state a content length. The 2000-character limit comes from its message resource documentation.
- Discord's interaction pages show no `Authorization` header on follow-up calls. Confirm that the interaction token alone is sufficient.
- The Telegram 4096-character limit and the `/command@botname` format were read from a tool summary, not verbatim text.
- The exact path of the `verification` object in Zalo's `setWebhook` response needs checking.
- Ed25519 support in the Workers `crypto.subtle` API was not part of the 2026-11-05 check.
