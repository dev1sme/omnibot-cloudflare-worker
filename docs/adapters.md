# Adapters

An adapter contains everything specific to one platform. It implements the `Adapter` contract in [contracts.md](contracts.md).

## Summary

| | Zalo | Telegram | Discord |
| --- | --- | --- | --- |
| Inbound | Webhook | Webhook | Interactions over HTTP |
| Verification | `X-Bot-Api-Secret-Token` | `X-Telegram-Bot-Api-Secret-Token` | Ed25519 signature |
| Required for `isEnabled` | `ZALO_BOT_TOKEN`, `WEBHOOK_SECRET` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBHOOK_SECRET` | `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY` |
| Acknowledgement | `{"ok":true}` | `{"ok":true}` | `{"type":5}` |
| Text limit | 2000 | 4096 | 2000 |
| Group chats in omnibot | No | Yes | Yes (server) |

## Shared rules

- `verify` MUST use the helpers and rules in [security.md](security.md).
- `reply` MUST send plain text. It MUST NOT set `parse_mode` or other formatting modes, because command output can contain user input.
- `reply` MUST use `splitMessage(text, limit)` from `src/lib/split-message.ts`.
- `reply` MUST check the HTTP status and the platform's `ok` field where one exists, then throw on failure.
- Adapters MUST NOT call `getUpdates` or any other polling API.

### Splitting messages

`splitMessage` MUST:

- Measure length with `string.length` (UTF-16 code units). This is never lower than the character count, so it stays within the limit.
- Prefer to break at a newline, then at a space.
- Never split a surrogate pair.
- Never return an empty chunk.

## Zalo

API base: `https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/<method>`.

**Verify.** Compare the `X-Bot-Api-Secret-Token` header with `WEBHOOK_SECRET`.

**Parse.**

| Payload | Result |
| --- | --- |
| `event_name` is `message.text.received` and `chat.chat_type` is `PRIVATE` | `message` |
| `chat.chat_type` is `GROUP` (Beta on Zalo) | `ignore` |
| Any other `event_name`, including `message.unsupported.received` | `ignore` |

| `IncomingMessage` | Source |
| --- | --- |
| `chatId` | `message.chat.id` |
| `user.id` | `message.from.id` |
| `user.name` | `message.from.display_name` |
| `text` | `message.text` |

**Reply.** `POST /sendMessage` with `chat_id` and `text`. Text length MUST be 1 to 2000.

## Telegram

API base: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/<method>`.

**Verify.** Compare the `X-Telegram-Bot-Api-Secret-Token` header with `WEBHOOK_SECRET`.

**Parse.** Return `message` only for an update that has `message.text` and `message.from`. Return `ignore` for all other updates.

| `IncomingMessage` | Source |
| --- | --- |
| `chatId` | `String(message.chat.id)` |
| `user.id` | `String(message.from.id)` |
| `user.name` | `message.from.first_name` |
| `text` | `message.text`, normalized as below |

**Normalize bot mentions.** Compare the mention case-insensitively with `TELEGRAM_BOT_USERNAME`.

| Input | Result |
| --- | --- |
| `/ping` | `text` is `/ping` |
| `/ping@this_bot arg` | `text` is `/ping arg` |
| `/ping@other_bot` | `ignore` |

**Reply.** `POST /sendMessage` with `chat_id` and `text`. Do not reply through the webhook response: Telegram allows it, but the bot cannot learn whether the request succeeded.

## Discord

API base: `https://discord.com/api/v10`.

Worker code reaches Discord only through the interaction token. The Worker therefore MUST NOT hold `DISCORD_BOT_TOKEN`, which only `scripts/register-discord.ts` needs.

**Verify.** See [security.md](security.md). A failed check MUST return 401. Discord sends invalid signatures on purpose and removes the endpoint URL if a request is accepted.

**Parse.**

| Interaction `type` | Result |
| --- | --- |
| `1` PING | `respond` with `{"type":1}`, status 200, `Content-Type: application/json` |
| `2` APPLICATION_COMMAND with `channel_id` | `message` |
| Anything else | `ignore` |

| `IncomingMessage` | Source |
| --- | --- |
| `chatId` | `channel_id` |
| `user.id` | `(member?.user ?? user).id` |
| `user.name` | `global_name` or `username` of the same user |
| `text` | `` `/${data.name}` `` |

Guild interactions carry the user in `member.user`. Direct messages carry it in `user`.

**Acknowledge.** Return `{"type":5}` (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`) with `Content-Type: application/json`. The response MUST arrive within 3 seconds of the event.

**Reply.**

1. Send the first chunk with `PATCH /webhooks/{app_id}/{token}/messages/@original`.
2. Send other chunks with `POST /webhooks/{app_id}/{token}`.

The token is valid for 15 minutes. The first `PATCH` MUST retry on 404, up to 3 attempts with a short delay, because `waitUntil` work can start before Discord has received the acknowledgement.

**Limitations.**

- The Worker receives slash commands only. It cannot read channel messages.
- Commands take no options in the current version, so `text` never carries arguments.

## Adding a platform

1. Confirm that the platform can deliver events through HTTP webhooks. Polling or a persistent connection does not fit a Worker.
2. Create `src/adapters/<name>.ts` that implements `Adapter`.
3. Add it to the list in `src/adapters/index.ts`. The `/webhook/<name>` route then works with no other routing change.
4. Add its secrets to `Env`, and add setup steps to [operations.md](operations.md).
5. Add a section to this document with its verification, parsing, and reply rules.
6. Add tests for valid verification, invalid verification, each parse result, and reply failure.
7. Update the status table in [README.md](README.md).

A new platform MUST NOT require changes in `src/commands/`. If it seems to, change the contract in a separate pull request first.
