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
  ADMIN_USER_IDS?: string;
}

export interface IncomingMessage {
  platform: string;
  messageId: string;
  chatId: string;
  chatType: "private" | "group";
  user: { id: string; name?: string };
  text: string;
  raw: unknown; // Original payload. Read by the owning adapter.
}

export interface OutgoingMessage {
  text: string;
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
  reply(msg: IncomingMessage, out: OutgoingMessage, env: Env): Promise<void>;
}

export interface CommandDeps {
  env: Env;
  ctx: ExecutionContext;
  commands: readonly Command[];
}

export interface Command {
  name: string;
  description: string;
  permission?: "everyone" | "admin"; // Defaults to "everyone"
  run(msg: IncomingMessage, deps: CommandDeps): Promise<OutgoingMessage>;
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
| `reply` | PHẢI chia nhỏ `out.text` nếu dài, và PHẢI throw nếu nền tảng từ chối tin nhắn |

## Validate payload

Mỗi adapter PHẢI khai báo schema Valibot trong `schema.ts`, và validate payload sau khi verify thành công.

```ts
const UpdateSchema = v.object({
  message: v.object({
    message_id: v.number(),
    chat: v.object({ id: v.number(), type: v.string() }),
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

## Response envelope

Mọi response do omnibot tự quyết format PHẢI dùng envelope. Thiết kế theo cùng chuẩn với `project-member-status`.

```ts
export interface ResponseMeta {
  timestamp: number; // Unix epoch seconds
}

export interface ValueResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: ResponseMeta;
}

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  code: ErrorCode;
  details?: Record<string, string[]>;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: ErrorBody;
  meta: ResponseMeta;
}
```

```jsonc
// Success
{ "success": true, "message": "OK", "data": null, "meta": { "timestamp": 1793923200 } }

// Error
{
  "success": false,
  "message": "Unauthorized",
  "error": { "code": "UNAUTHORIZED" },
  "meta": { "timestamp": 1793923200 }
}
```

Quy tắc:

- Response chỉ được tạo qua `ok()` và `fail(code)` trong `src/core/response.ts`.
- HTTP status chỉ nằm trên status line, không lặp trong body.
- `error.code` là chuỗi ổn định, viết `UPPER_SNAKE_CASE`. Client dựa vào `code`, không dựa vào `message`.
- `fail(code)` lấy status và `message` từ một bảng cố định. `message` KHÔNG ĐƯỢC chứa dữ liệu runtime hay lý do chi tiết.
- Field trong JSON của envelope viết `snake_case`.
- API trả danh sách như dashboard sẽ thêm `ListResponse` và `PageResponse` khi thật sự cần, theo cùng shape.

### Ngoại lệ: protocol của nền tảng

Response do nền tảng quy định format PHẢI giữ đúng format đó, KHÔNG ĐƯỢC bọc envelope.

| Response | Body |
| --- | --- |
| Discord `PING` | `{"type":1}` |
| Discord acknowledgement | `{"type":5}` |

Chỉ `ParseResult` loại `respond` và `ack` của adapter mới được trả format riêng. Mỗi ngoại lệ PHẢI có trong bảng này hoặc trong mục của nền tảng ở [adapters.md](adapters.md).

## Hành vi HTTP

| Điều kiện | Status | Body |
| --- | --- | --- |
| Path không phải `/webhook/<adapter đã biết>` | 404 | `fail("NOT_FOUND")` |
| Method khác `POST` trên path webhook | 405 | `fail("METHOD_NOT_ALLOWED")` |
| Adapter đang tắt | 404 | `fail("NOT_FOUND")` |
| Xác minh thất bại | 401 | `fail("UNAUTHORIZED")` |
| `parse` trả `ignore` | 200 | `ok()` |
| `parse` trả `respond` | Do adapter đặt | Do adapter đặt |
| Nội dung không phải lệnh | 200 | `ok()` |
| Lệnh hợp lệ hoặc lệnh không tồn tại đã được nhận | Từ `ack` | Từ `ack` |
| Lỗi không lường trước khi chưa acknowledge | 500 | `fail("INTERNAL_ERROR")` |

Lệnh chạy lỗi KHÔNG ĐƯỢC làm thay đổi kết quả HTTP, vì acknowledgement đã được gửi đi.

## Cơ chế delivery

- Sau khi acknowledge, delivery là at-most-once. Việc thất bại trong `waitUntil` được ghi log và không retry.
- Vẫn có thể nhận trùng. Telegram gửi lại webhook sau response không phải 2xx, còn Zalo không ghi rõ chính sách retry.
- omnibot không có cơ chế deduplication toàn cục. KV không phù hợp cho việc này: thay đổi có thể mất từ 60 giây trở lên mới đến các location khác, và free tier chỉ cho 1.000 lượt ghi mỗi ngày.
- Lệnh có side effect PHẢI chịu được việc chạy hai lần. Nếu không thể, lệnh cần một store strongly consistent như Durable Objects hoặc D1.
