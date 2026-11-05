# Kiến trúc

omnibot là một Cloudflare Worker phục vụ nhiều nền tảng chat. Logic lệnh chỉ viết một lần. Khác biệt giữa các nền tảng nằm gọn trong adapter.

## Các layer

| Layer | Vị trí | Trách nhiệm |
| --- | --- | --- |
| Entry point | `src/index.ts` | Export Worker cho runtime |
| Composition root | `src/app.ts` | Khai báo route Hono, nối adapter, core và command |
| Core | `src/core/` | Type, pipeline, router và response envelope, không biết nền tảng hay lệnh cụ thể |
| Adapter | `src/adapters/<name>/` | Xác minh, parse, acknowledge và reply cho một nền tảng |
| Command | `src/commands/` | Logic không phụ thuộc nền tảng |
| Library | `src/lib/` | Helper dùng chung như `splitMessage` và `secretEquals` |
| Script | `scripts/` | Tác vụ cài đặt chạy một lần trên máy developer |

## Quy tắc phụ thuộc

| Module | CÓ THỂ import |
| --- | --- |
| `src/app.ts` | Tất cả các layer trong `src/` |
| `src/core/` | `src/lib/` |
| `src/adapters/<name>/` | `src/core/types.ts`, `src/core/response.ts`, `src/lib/`, file trong chính thư mục của nó |
| `src/commands/` | `src/core/types.ts`, `src/lib/` |
| `src/lib/` | Không import layer nào |
| `scripts/` | `src/commands/`, `src/core/types.ts` |

- Adapter KHÔNG ĐƯỢC import adapter khác. Phần dùng chung phải chuyển vào `src/lib/`.
- Code của Worker KHÔNG ĐƯỢC import từ `scripts/`.
- Command KHÔNG NÊN đọc `msg.raw` hoặc rẽ nhánh hành vi theo `msg.platform`. Hiển thị tên nền tảng thì được.
- Thư viện của một nền tảng chỉ được import trong thư mục adapter đó.

`src/app.ts` là module duy nhất kết nối adapter, core và command.

## Cấu trúc thư mục

```
src/
├── index.ts                # Worker entry point
├── app.ts                  # Hono routes, wires the layers together
├── core/
│   ├── types.ts            # Contracts from contracts.md
│   ├── pipeline.ts         # Request lifecycle
│   ├── response.ts         # Response envelope helpers
│   └── router.ts           # Command resolution
├── adapters/
│   ├── index.ts            # Adapter registry
│   ├── telegram/
│   │   ├── index.ts        # Exports the adapter object
│   │   ├── verify.ts
│   │   ├── parse.ts
│   │   ├── reply.ts
│   │   ├── schema.ts       # Payload schema
│   │   └── client.ts       # Optional: thin API client
│   ├── zalo/
│   └── discord/
├── commands/
│   ├── index.ts            # Command registry
│   ├── ping.ts
│   └── help.ts
└── lib/
    ├── parse-json.ts
    ├── secret-equals.ts
    └── split-message.ts
scripts/
├── set-webhooks.ts
└── register-discord.ts
```

- Test đặt cạnh file được test, ví dụ `src/core/router.test.ts`.
- Thêm nền tảng chỉ cần thêm một thư mục trong `src/adapters/` và một dòng trong registry. Xem [adapters.md](adapters.md#thêm-nền-tảng).
- Thêm lệnh chỉ cần thêm một file trong `src/commands/` và một dòng trong registry.
- Chỉ tạo thư mục mới cấp `src/` khi có nhu cầu thật, và phải cập nhật tài liệu này trong cùng pull request.

## Routing

```ts
const app = new Hono<{ Bindings: Env }>();

app.all("/webhook/:platform", (c) => {
  const adapter = adapters.find((a) => a.name === c.req.param("platform"));
  if (!adapter) return fail("NOT_FOUND");
  if (c.req.method !== "POST") return fail("METHOD_NOT_ALLOWED");
  return handleWebhook(c.req.raw, adapter, commands, c.env, c.executionCtx);
});

app.notFound(() => fail("NOT_FOUND"));
app.onError((error) => {
  logUnexpectedError(error);
  return fail("INTERNAL_ERROR");
});
```

## Vòng đời request

```ts
async function handleWebhook(
  req: Request,
  adapter: Adapter,
  commands: Command[],
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (!adapter.isEnabled(env)) return fail("NOT_FOUND");

  // The body can be read only once, so the pipeline owns this read.
  const rawBody = await req.text();

  if (!(await adapter.verify(rawBody, req.headers, env))) {
    return fail("UNAUTHORIZED");
  }

  const parsed = adapter.parse(rawBody, env);
  if (parsed.kind === "respond") return parsed.response;
  if (parsed.kind === "ignore") return ok();

  const route = resolve(parsed.msg.text, commands);
  if (route.kind === "none") return ok();

  ctx.waitUntil(execute(route, parsed.msg, adapter, env, ctx));
  return adapter.ack(parsed.msg);
}
```

Các bước PHẢI giữ đúng thứ tự này:

1. Kiểm tra adapter đang bật.
2. Đọc raw body một lần.
3. Xác minh request. Không có gì được parse body trước khi bước này thành công.
4. Parse body thành `ParseResult`.
5. Xác định lệnh.
6. Lên lịch xử lý bằng `ctx.waitUntil()`.
7. Trả về acknowledgement.

## Vì sao mọi lệnh đều chạy nền

Discord huỷ interaction token nếu phản hồi đầu tiên mất hơn 3 giây. Lệnh không thể cam kết xong trong thời gian đó, vì có thể phải gọi API ngoài.

Vì vậy mọi nền tảng đi chung một luồng: acknowledge trước, sau đó chạy lệnh và gửi reply trong `ctx.waitUntil()`. Cái giá của quy tắc này là người dùng Discord sẽ thấy trạng thái loading trong chốc lát, kể cả với `/ping`.

## Thực thi

`execute` chạy sau khi response đã được trả về, nên không còn gì bắt được lỗi của nó. Hàm này KHÔNG ĐƯỢC reject.

```ts
async function execute(route, msg, adapter, env, ctx) {
  let out: OutgoingMessage;
  try {
    out = route.kind === "unknown"
      ? UNKNOWN_COMMAND_REPLY
      : await route.command.run(msg, { env, ctx });
  } catch (error) {
    logError("command_failed", msg, error);
    out = COMMAND_FAILED_REPLY;
  }

  try {
    await adapter.reply(msg, out, env);
  } catch (error) {
    logError("reply_failed", msg, error);
  }
}
```

`logError` PHẢI tuân theo quy tắc logging trong [security.md](security.md).

## Ngoài phạm vi

- Long-polling và `getUpdates`. Worker không chạy liên tục, và Zalo coi polling với webhook là loại trừ lẫn nhau.
- Discord Gateway. Muốn đọc mọi tin nhắn trong kênh thì cần kết nối WebSocket liên tục, tức là cần server riêng hoặc Durable Objects.
- Tài khoản Zalo cá nhân. omnibot chỉ dùng Zalo Bot Platform chính thức.
