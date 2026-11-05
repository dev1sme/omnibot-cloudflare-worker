# Bảo mật

Các endpoint webhook là public. Hãy coi mọi request là thù địch cho đến khi `verify` thành công.

## Xác minh

- Mọi adapter PHẢI xác minh mọi request trước khi parse body.
- Kiểm tra thất bại PHẢI trả 401 với `fail("UNAUTHORIZED")` và không nêu lý do. Discord cũng yêu cầu 401. Code mẫu của Zalo dùng 403, nhưng tài liệu của Zalo không yêu cầu status cụ thể.
- `verify` PHẢI fail closed. Header thiếu hoặc giá trị sai định dạng thì trả `false`.
- KHÔNG ĐƯỢC tự viết thuật toán crypto. Dùng thư viện đã chọn hoặc `crypto.subtle` của runtime.

### Shared secret (Zalo, Telegram)

So sánh constant-time. Hash cả hai giá trị trước để so sánh được các giá trị khác độ dài.

```ts
const encoder = new TextEncoder();

export async function secretEquals(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all(
    [a, b].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))),
  );
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
```

KHÔNG ĐƯỢC so sánh secret bằng `===`.

### Chữ ký Ed25519 (Discord)

Dùng `verifyKey` của `discord-interactions`. Hàm này kiểm tra `X-Signature-Ed25519` trên các byte của `X-Signature-Timestamp` nối với raw body.

```ts
const signature = headers.get("X-Signature-Ed25519");
const timestamp = headers.get("X-Signature-Timestamp");
if (!signature || !timestamp) return false;

return verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
```

- Các byte được ký PHẢI lấy từ body gốc. Parse rồi serialize lại JSON sẽ làm hỏng chữ ký.
- `verifyKey` nuốt mọi lỗi và trả `false`, nên lỗi runtime trông giống chữ ký sai. Test PHẢI có trường hợp chữ ký đúng chạy trong Workers runtime để phát hiện việc này.

## Secret

`WEBHOOK_SECRET` PHẢI dài từ 8 đến 256 ký tự và chỉ dùng `A-Z`, `a-z`, `0-9`, `_`, `-`.

Định dạng này thoả cả hai nền tảng. Zalo yêu cầu 8 đến 256 ký tự, còn Telegram chỉ cho phép các ký tự này.

Tạo giá trị bằng:

```bash
openssl rand -hex 32
```

| Secret | Worker | Script |
| --- | --- | --- |
| `WEBHOOK_SECRET` | Có | `set-webhooks` |
| `ZALO_BOT_TOKEN` | Có | `set-webhooks` |
| `TELEGRAM_BOT_TOKEN` | Có | `set-webhooks` |
| `DISCORD_APP_ID` | Có | `register-discord` |
| `DISCORD_PUBLIC_KEY` | Có | Không |
| `DISCORD_BOT_TOKEN` | **Không** | `register-discord` |
| `ADMIN_USER_IDS` | Có | Không |

- Secret đã deploy PHẢI được đặt bằng `npx wrangler secret put`.
- Dev và production PHẢI dùng bot, secret và KV khác nhau.
- `CLOUDFLARE_API_TOKEN` PHẢI nằm trong secret của CI, chỉ có quyền tối thiểu để deploy, và KHÔNG ĐƯỢC commit.
- Secret KHÔNG ĐƯỢC xuất hiện trong `[vars]` của `wrangler.toml`, trong source code, hoặc trong commit.
- `.dev.vars*` và `.env*` PHẢI có trong `.gitignore`.
- Worker KHÔNG ĐƯỢC giữ secret mà nó không dùng.

### Rotation

1. Đặt giá trị mới bằng `npx wrangler secret put`.
2. Với `WEBHOOK_SECRET`, chạy `npm run set-webhooks` ngay. Webhook sẽ lỗi 401 cho đến khi bước này xong.
3. Thu hồi giá trị cũ trên nền tảng, nếu đó là token của nền tảng.

## Logging

**Zalo và Telegram đặt bot token trong URL API.** Vì vậy log URL hoặc object request sẽ làm lộ token.

Log KHÔNG ĐƯỢC chứa:

- Token, secret, hoặc chữ ký
- URL request tới API của nền tảng
- Request header
- Interaction token của Discord
- Nội dung tin nhắn hoặc `msg.raw`

Log CÓ THỂ chứa tên nền tảng, tên lệnh, chat ID, response status, và mã lỗi của nền tảng. Format xem [conventions.md](conventions.md#logging). Log entry NÊN chỉ chứa ID khi cần cho việc debug.

Coi lỗi từ `fetch` và SDK là nhạy cảm. Hãy log status và mã lỗi của nền tảng, không log nguyên object lỗi.

Adapter PHẢI chuyển lỗi gốc thành `PlatformError` trước khi throw. Ví dụ, với lỗi của grammY:

- `GrammyError`: chỉ log `error_code` và `method`. Không log `payload`, vì trường này chứa dữ liệu request.
- `HttpError`: chỉ log tên lỗi. Không log `error` hay `message`, vì tài liệu không đảm bảo chúng không chứa URL có token.

## Dependency

- PHẢI commit `package-lock.json`, và cài trong CI bằng `npm ci`.
- Thêm hoặc nâng cấp package giữ token, hoặc xử lý chữ ký, PHẢI được review riêng.
- Chạy `npm audit` trước mỗi lần deploy production.

## Output

- Thông báo lỗi người dùng thấy PHẢI chung chung.
- `message` và `error` trong envelope KHÔNG ĐƯỢC chứa stack trace, chi tiết lỗi nội bộ hay lý do xác minh thất bại.
- `reply` PHẢI gửi plain text, để nội dung người dùng nhập không chèn được markup của nền tảng.
- Output Discord có thể lặp lại nội dung người dùng nhập KHÔNG ĐƯỢC kích hoạt mention. Đặt `allowed_mentions: { parse: [] }` trong reply.
