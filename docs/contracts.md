# Contract

`src/core/types.ts` PHẢI implement các type này. Thay đổi ở đây ảnh hưởng đến mọi adapter và command, nên hãy cập nhật tài liệu này trong cùng pull request.

## Type

```ts
export interface Env {
  OMNIBOT_KV: KVNamespace;
  WEBHOOK_SECRET?: string;
  ZALO_BOT_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  DISCORD_APP_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
}

export interface IncomingMessage {
  platform: string;
  chatId: string;
  user: { id: string; name?: string };
  text: string;
  raw: unknown; // Original payload. Read by the owning adapter.
}

export type ParseResult =
  | { kind: "message"; msg: IncomingMessage }
  | { kind: "respond"; response: Response } // For example, Discord PING
  | { kind: "ignore" };

export interface Adapter {
  name: string;
  isEnabled(env: Env): boolean;
  verify(rawBody: string, headers: Headers, env: Env): Promise<boolean>;
  parse(rawBody: string, env: Env): ParseResult;
  ack(msg: IncomingMessage): Response;
  reply(msg: IncomingMessage, text: string, env: Env): Promise<void>;
}

export interface CommandDeps {
  env: Env;
  ctx: ExecutionContext;
}

export interface Command {
  name: string;
  description: string;
  run(msg: IncomingMessage, deps: CommandDeps): Promise<string>;
}

export type Route =
  | { kind: "command"; command: Command }
  | { kind: "unknown" } // Starts with "/" but matches no command
  | { kind: "none" }; // Not a command
```

## Quy tắc cho từng method của adapter

| Method | Quy tắc |
| --- | --- |
| `name` | PHẢI viết thường, và trùng với đoạn path `/webhook/<name>` cũng như `msg.platform` |
| `isEnabled` | PHẢI trả `false` nếu thiếu bất kỳ secret nào adapter cần |
| `verify` | PHẢI trả `false` khi thất bại, kể cả khi header thiếu hoặc sai định dạng. KHÔNG ĐƯỢC throw |
| `parse` | PHẢI trả `ignore` với payload sai định dạng hoặc không hỗ trợ. KHÔNG ĐƯỢC throw |
| `ack` | PHẢI trả về mà không gọi network |
| `reply` | PHẢI chia nhỏ tin dài, và PHẢI throw nếu nền tảng từ chối tin nhắn |

## Validate payload

Mỗi adapter PHẢI khai báo schema Valibot trong `schema.ts`, và validate payload sau khi verify thành công.

```ts
const UpdateSchema = v.object({
  message: v.object({
    chat: v.object({ id: v.number() }),
    from: v.object({ id: v.number(), first_name: v.string() }),
    text: v.string(),
  }),
});

export function parse(rawBody: string): ParseResult {
  const result = v.safeParse(UpdateSchema, parseJson(rawBody));
  if (!result.success) return { kind: "ignore" };
  // Map result.output to IncomingMessage.
}
```

- Schema chỉ khai báo các trường adapter dùng. KHÔNG ĐƯỢC dùng object strict, vì nền tảng có thể thêm trường mới bất kỳ lúc nào.
- Dùng `v.safeParse`, không dùng `v.parse`, vì `parse` của adapter không được throw.
- `parseJson` trong `src/lib/` trả `undefined` khi JSON sai định dạng.
- Giữ schema nhỏ. Worker chỉ có 1 giây startup, và schema lớn ở top level là nguyên nhân phổ biến khiến vượt giới hạn này.

## Hành vi HTTP

| Điều kiện | Status | Body |
| --- | --- | --- |
| Path không phải `/webhook/<adapter đã biết>` | 404 | Rỗng |
| Method khác `POST` trên path webhook | 405 | Rỗng |
| Adapter đang tắt | 404 | Rỗng |
| Xác minh thất bại | 401 | Rỗng |
| `parse` trả `ignore` | 200 | `{"ok":true}` |
| `parse` trả `respond` | Do adapter đặt | Do adapter đặt |
| Nội dung không phải lệnh | 200 | `{"ok":true}` |
| Lệnh hợp lệ hoặc lệnh không tồn tại đã được nhận | Từ `ack` | Từ `ack` |
| Lỗi không lường trước khi chưa acknowledge | 500 | Rỗng |

Lệnh chạy lỗi KHÔNG ĐƯỢC làm thay đổi kết quả HTTP, vì acknowledgement đã được gửi đi.

## Cơ chế delivery

- Sau khi acknowledge, delivery là at-most-once. Việc thất bại trong `waitUntil` được ghi log và không retry.
- Vẫn có thể nhận trùng. Telegram gửi lại webhook sau response không phải 2xx, còn Zalo không ghi rõ chính sách retry.
- omnibot không có cơ chế deduplication toàn cục. KV không phù hợp cho việc này: thay đổi có thể mất từ 60 giây trở lên mới đến các location khác, và free tier chỉ cho 1.000 lượt ghi mỗi ngày.
- Lệnh có side effect PHẢI chịu được việc chạy hai lần. Nếu không thể, lệnh cần một store strongly consistent như Durable Objects hoặc D1.
