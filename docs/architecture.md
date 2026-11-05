# Kiến trúc

omnibot là một Cloudflare Worker phục vụ nhiều nền tảng chat. Logic lệnh chỉ viết một lần. Khác biệt giữa các nền tảng nằm gọn trong adapter.

## Các layer

| Layer | Vị trí | Trách nhiệm |
| --- | --- | --- |
| Entry point | `src/index.ts` | Khớp route, chạy pipeline, chuyển kết quả thành HTTP |
| Adapter | `src/adapters/` | Xác minh, parse, acknowledge và reply cho một nền tảng |
| Router | `src/router.ts` | Ánh xạ nội dung tin nhắn sang lệnh |
| Command | `src/commands/` | Logic không phụ thuộc nền tảng |
| Library | `src/lib/` | Helper dùng chung như `splitMessage` và `secretEquals` |
| Script | `scripts/` | Tác vụ cài đặt chạy một lần trên máy developer |

## Quy tắc phụ thuộc

- Command KHÔNG ĐƯỢC import từ `src/adapters/`.
- Command KHÔNG NÊN đọc `msg.raw` hoặc rẽ nhánh hành vi theo `msg.platform`. Hiển thị tên nền tảng thì được.
- Adapter KHÔNG ĐƯỢC import từ `src/commands/` hoặc `src/router.ts`.
- Router KHÔNG ĐƯỢC import từ `src/adapters/`.
- `src/lib/` KHÔNG ĐƯỢC import từ layer nào khác.
- Code của Worker KHÔNG ĐƯỢC import từ `scripts/`.

`src/index.ts` là module duy nhất kết nối adapter, router và command.

## Cấu trúc thư mục

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

## Vòng đời request

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

`logError` PHẢI tuân theo quy tắc logging trong [security.md](security.md).

## Ngoài phạm vi

- Long-polling và `getUpdates`. Worker không chạy liên tục, và Zalo coi polling với webhook là loại trừ lẫn nhau.
- Discord Gateway. Muốn đọc mọi tin nhắn trong kênh thì cần kết nối WebSocket liên tục, tức là cần server riêng hoặc Durable Objects.
- Tài khoản Zalo cá nhân. omnibot chỉ dùng Zalo Bot Platform chính thức.
