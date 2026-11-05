# Security

The webhook endpoints are public. Treat every request as hostile until `verify` succeeds.

## Verification

- Every adapter MUST verify every request before parsing its body.
- A failed check MUST return 401 with an empty body and reveal no reason. Zalo's sample code uses 403, but its documentation requires no specific status.
- `verify` MUST fail closed. A missing header or malformed value returns `false`.

### Shared secret (Zalo, Telegram)

Compare in constant time. Hash both values first so that values of different lengths can be compared.

```ts
const encoder = new TextEncoder();

export async function secretEquals(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all(
    [a, b].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
```

MUST NOT compare secrets with `===`.

### Ed25519 signature (Discord)

Verify `X-Signature-Ed25519` against the bytes of `X-Signature-Timestamp` followed by the raw body. The signature and public key are hex-encoded.

```ts
const key = await crypto.subtle.importKey(
  "raw",
  hexToBytes(env.DISCORD_PUBLIC_KEY),
  { name: "Ed25519" },
  false,
  ["verify"],
);
return crypto.subtle.verify(
  { name: "Ed25519" },
  key,
  hexToBytes(signature),
  encoder.encode(timestamp + rawBody),
);
```

- The signed bytes MUST come from the original body. Parsing and re-serializing JSON breaks the signature.
- Catch errors from malformed input and return `false`.

## Secrets

`WEBHOOK_SECRET` MUST be 8 to 256 characters and use only `A-Z`, `a-z`, `0-9`, `_`, and `-`.

This format satisfies both platforms. Zalo requires 8 to 256 characters, and Telegram allows only these characters.

Generate one with:

```bash
openssl rand -hex 32
```

| Secret | Worker | Scripts |
| --- | --- | --- |
| `WEBHOOK_SECRET` | Yes | `set-webhooks` |
| `ZALO_BOT_TOKEN` | Yes | `set-webhooks` |
| `TELEGRAM_BOT_TOKEN` | Yes | `set-webhooks` |
| `DISCORD_APP_ID` | Yes | `register-discord` |
| `DISCORD_PUBLIC_KEY` | Yes | No |
| `DISCORD_BOT_TOKEN` | **No** | `register-discord` |

- Deployed secrets MUST be set with `npx wrangler secret put`.
- Secrets MUST NOT appear in `[vars]` in `wrangler.toml`, in source code, or in a commit.
- `.dev.vars*` and `.env*` MUST be listed in `.gitignore`.
- The Worker MUST NOT hold a secret it does not use.

### Rotation

1. Set the new value with `npx wrangler secret put`.
2. For `WEBHOOK_SECRET`, run `npm run set-webhooks` immediately. Webhooks fail with 401 until this step finishes.
3. Revoke the old value on the platform, if it is a platform token.

## Logging

**Zalo and Telegram put the bot token in the API URL.** A logged URL or request object therefore exposes the token.

Logs MUST NOT contain:

- Tokens, secrets, or signatures
- Request URLs for platform APIs
- Request headers
- Discord interaction tokens
- Message text or `msg.raw`

Logs MAY contain the platform name, the command name, a chat ID, a response status, and a sanitized error message. A log entry SHOULD include IDs only when they are needed for debugging.

Treat errors from `fetch` as sensitive. Log the status and platform error code, not the whole error object.

## Output

- User-visible errors MUST be generic.
- `reply` MUST send plain text, so that user input cannot inject platform markup.
- Discord output that can repeat user input MUST NOT trigger mentions. Set `allowed_mentions: { parse: [] }` on replies.
