# Conventions

## Language

Code, comments, identifiers, commit messages, and these documents MUST be in English. Bot replies and the root `README.md` MAY use Vietnamese.

## TypeScript

- Enable `strict` in `tsconfig.json`.
- MUST NOT use `any`. Use `unknown` for external data, and narrow it inside the adapter.
- Use `import type` for type-only imports.
- Use named exports. The only default export is the Worker handler in `src/index.ts`, which the runtime requires.
- Use Web APIs (`fetch`, `crypto.subtle`, `Response`). Do not add Node.js-only APIs to Worker code.
- Keep runtime dependencies to a minimum. Each one adds to the bundle and to the supply chain, so a pull request that adds one MUST state why.

## Naming

| Item | Style | Example |
| --- | --- | --- |
| Files | `kebab-case.ts` | `split-message.ts` |
| Functions, variables | `camelCase` | `splitMessage` |
| Types, interfaces | `PascalCase` | `IncomingMessage` |
| Module constants | `UPPER_SNAKE_CASE` | `MAX_TEXT_LENGTH` |
| Environment values | `UPPER_SNAKE_CASE` | `TELEGRAM_BOT_TOKEN` |
| Command objects | Command name | `export const hello` |
| Adapter objects | Platform name | `export const telegram` |

## Constants

Platform limits and API base URLs MUST be named constants in the adapter that uses them.

```ts
const MAX_TEXT_LENGTH = 4096;
```

## Errors

- `verify` and `parse` return a value on failure. They do not throw.
- `reply` and commands throw on failure. The pipeline catches and logs the error.
- Do not swallow an error without logging it. Logging follows [security.md](security.md).

## Testing

The stack is Vitest with `@cloudflare/vitest-pool-workers`, so tests run in the Workers runtime.

Tests MUST NOT call real platform APIs. Stub `fetch`.

| Component | Required tests |
| --- | --- |
| Pipeline | Each row in the HTTP table in [contracts.md](contracts.md), and verification running before parsing |
| `verify` | Valid, wrong value, missing header, malformed value |
| `parse` | Each row in the adapter's parse table, plus malformed JSON |
| `reply` | Request shape, long text splitting, platform rejection throwing |
| Router | Each row in the routing table in [commands.md](commands.md) |
| `splitMessage` | Exact limit, limit plus one, no surrogate pair split, no empty chunk |
| Command list | Name and description rules, and unique names |
| Each command | Its reply, and each of its failure paths |

Discord signature tests MUST use a real Ed25519 key pair generated in the test.

## Commits

Follow Conventional Commits:

```
<type>(<scope>): <subject>
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scopes: `router`, `pipeline`, `zalo`, `telegram`, `discord`, `commands`, `scripts`, or a command name.
- The subject is imperative and lowercase, has no trailing period, and the header is at most 72 characters.
- Make one logical change per commit.

```
feat(telegram): strip bot mention from commands
fix(discord): retry first reply edit on 404
```

## Branches and pull requests

- MUST NOT commit directly to `main`. Use a pull request.
- Branch names follow `<type>/<short-description>`, such as `feat/telegram-adapter`.
- Run `npm run lint && npm test` before opening a pull request.

## Definition of Done

A change is done when all of these are true:

- [ ] `npm run lint` and `npm test` pass.
- [ ] Tests cover the new behavior and its failure paths.
- [ ] The dependency rules in [architecture.md](architecture.md) still hold.
- [ ] No secret, token, or message text appears in logs.
- [ ] Documents match the code, including the status table in [README.md](README.md).
- [ ] New secrets are in `Env` and in [operations.md](operations.md).
- [ ] New or changed commands have been registered with `npm run register-discord`, if deployed.
- [ ] The change has been tested through a tunnel or deployment on each affected platform. Note in the pull request if this was not possible.
