# Operations

## Requirements

- A Node.js release in Current, Active, or Maintenance status. Wrangler supports these and sets no fixed minimum in its documentation.
- A Cloudflare account.
- Wrangler as a project `devDependency`, run with `npx wrangler`. Do not install it globally. Cloudflare recommends a local install so that the whole project uses one version.

## Configuration

Configure only the platforms you use. An adapter with missing values is disabled, and its route returns 404.

| Name | Type | Used by |
| --- | --- | --- |
| `WEBHOOK_SECRET` | Secret | Zalo, Telegram |
| `ZALO_BOT_TOKEN` | Secret | Zalo |
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram |
| `TELEGRAM_BOT_USERNAME` | `[vars]` | Telegram |
| `DISCORD_APP_ID` | Secret | Discord |
| `DISCORD_PUBLIC_KEY` | Secret | Discord |
| `DISCORD_BOT_TOKEN` | Local only | `register-discord` |
| `OMNIBOT_KV` | KV binding | Commands |

`wrangler.toml`:

```toml
name = "omnibot"
main = "src/index.ts"
compatibility_date = "2026-11-01"

[vars]
TELEGRAM_BOT_USERNAME = "your_bot"

[[kv_namespaces]]
binding = "OMNIBOT_KV"
id = "<your-kv-id>"
```

Keep a fixed `compatibility_date`. Change it deliberately and test the change.

## First deployment

Run these steps in order. Webhook registration needs a deployed URL, and platforms send test requests that need the secrets in place.

1. Install dependencies and log in:

   ```bash
   npm install
   npx wrangler login
   ```

2. Create the KV namespace, then copy its `id` into `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create OMNIBOT_KV
   ```

3. Set the secrets for the platforms you use:

   ```bash
   npx wrangler secret put WEBHOOK_SECRET
   npx wrangler secret put ZALO_BOT_TOKEN
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put DISCORD_APP_ID
   npx wrangler secret put DISCORD_PUBLIC_KEY
   ```

4. Create `.dev.vars` with the values that the scripts need. See [Local secrets](#local-secrets).

5. Deploy:

   ```bash
   npm run deploy
   ```

6. Register webhooks and commands:

   ```bash
   WORKER_URL=https://omnibot.<subdomain>.workers.dev npm run set-webhooks
   npm run register-discord
   ```

7. In the Discord Developer Portal, open **General Information** and set **Interactions Endpoint URL** to `https://omnibot.<subdomain>.workers.dev/webhook/discord`. Discord tests the endpoint when you save, so the Worker must already be deployed.

8. Send `/ping` to the bot on each platform.

## Local secrets

Wrangler cannot read deployed secret values back, so scripts and `npm run dev` read a local `.dev.vars` file. It uses dotenv syntax:

```bash
WEBHOOK_SECRET="..."
ZALO_BOT_TOKEN="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_USERNAME="your_bot"
DISCORD_APP_ID="..."
DISCORD_PUBLIC_KEY="..."
DISCORD_BOT_TOKEN="..."
```

Use `.dev.vars` or `.env`, not both. If `.dev.vars` exists, Wrangler does not load `.env`. Neither file may be committed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run locally at `http://localhost:8787` |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run set-webhooks` | Register Zalo and Telegram webhooks |
| `npm run register-discord` | Overwrite Discord global commands |
| `npm run tail` | Stream logs with `wrangler tail` |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

### `set-webhooks` requirements

- Skip a platform whose token is absent, and print that it was skipped.
- Pass `secret_token` to both platforms.
- For Telegram, pass `allowed_updates: ["message"]`.
- For Zalo, check that the `verification` outcome is `webhook.ok`, and fail if it is not. Zalo saves the URL even when verification fails.
- Print no secret values.

### `register-discord` requirements

- Use `PUT /applications/{app_id}/commands` to overwrite the global list, so that removed commands disappear.
- Build the list from `src/commands/index.ts`, so that it cannot drift from the code.
- Run it only when commands change. Discord limits command creation to 200 per day per guild.

`PUT` replaces **all** of the application's global commands, including any created outside this repository.

## Local development

```bash
npm run dev
cloudflared tunnel --url http://localhost:8787
WORKER_URL=https://<tunnel-host> npm run set-webhooks
```

Platforms cannot reach `localhost`, and Zalo explicitly rejects it, so local testing needs a tunnel.

**Running `set-webhooks` with a tunnel URL replaces the production webhook for that bot.** Use separate development bots. If you use a production bot, rerun `set-webhooks` with the Worker URL when you finish.

## Free tier limits

| Resource | Limit | Consequence |
| --- | --- | --- |
| Requests | 100,000 per day, reset at midnight UTC | Excess requests return Error 1027 |
| CPU time | 10 ms per HTTP request | Avoid heavy parsing and computation |
| Subrequests | 50 per invocation | A long reply uses one per chunk |
| `waitUntil` | 30 seconds after the response, shared per request | Set timeouts on external calls |
| KV reads | 100,000 per day | |
| KV writes | 1,000 per day to different keys, 1 per second to one key | Do not write on every message |
| KV key / value | 512 bytes / 25 MiB | |
| KV propagation | 60 seconds or more | Do not rely on read-after-write |

Telegram also needs its webhook on port 443, 80, 88, or 8443. The default `workers.dev` URL uses 443.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Route returns 404 | Adapter is disabled | Check the required values in [adapters.md](adapters.md) |
| Route returns 401 | Secret does not match | Rerun `set-webhooks` after changing `WEBHOOK_SECRET` |
| Discord rejects the endpoint URL | Signature check or `PING` failed | Check `DISCORD_PUBLIC_KEY` and `PONG` handling |
| Discord shows "thinking" and never replies | `reply` failed in `waitUntil` | Run `npm run tail` and check `reply_failed` |
| Slash command is missing | Commands not registered | Run `npm run register-discord` |
| Telegram `setWebhook` rejects the secret | Invalid characters | See the format in [security.md](security.md) |
