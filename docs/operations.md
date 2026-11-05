# Vận hành

## Yêu cầu

- Node.js bản đang ở trạng thái Current, Active hoặc Maintenance. Wrangler hỗ trợ các bản này và tài liệu không nêu con số tối thiểu cố định.
- Tài khoản Cloudflare.
- Wrangler là `devDependency` của dự án, chạy bằng `npx wrangler`. Không cài global. Cloudflare khuyến nghị cài local để cả dự án dùng chung một phiên bản.

## Cấu hình

Chỉ cấu hình nền tảng cần dùng. Adapter thiếu giá trị sẽ bị tắt, và route của nó trả 404.

| Tên | Loại | Dùng cho |
| --- | --- | --- |
| `WEBHOOK_SECRET` | Secret | Zalo, Telegram |
| `ZALO_BOT_TOKEN` | Secret | Zalo |
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram |
| `TELEGRAM_BOT_USERNAME` | `[vars]` | Telegram |
| `DISCORD_APP_ID` | Secret | Discord |
| `DISCORD_PUBLIC_KEY` | Secret | Discord |
| `DISCORD_BOT_TOKEN` | Chỉ local | `register-discord` |
| `OMNIBOT_KV` | KV binding | Command |

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

Giữ `compatibility_date` cố định. Chỉ đổi khi có chủ đích, và phải test sau khi đổi.

## Deploy lần đầu

Chạy các bước theo đúng thứ tự. Đăng ký webhook cần URL đã deploy, và nền tảng gửi request kiểm tra nên secret phải có sẵn.

1. Cài dependency và đăng nhập:

   ```bash
   npm install
   npx wrangler login
   ```

2. Tạo KV namespace, rồi chép `id` vào `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create OMNIBOT_KV
   ```

3. Đặt secret cho các nền tảng sẽ dùng:

   ```bash
   npx wrangler secret put WEBHOOK_SECRET
   npx wrangler secret put ZALO_BOT_TOKEN
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put DISCORD_APP_ID
   npx wrangler secret put DISCORD_PUBLIC_KEY
   ```

4. Tạo `.dev.vars` với các giá trị script cần. Xem [Secret cục bộ](#secret-cục-bộ).

5. Deploy:

   ```bash
   npm run deploy
   ```

6. Đăng ký webhook và lệnh:

   ```bash
   WORKER_URL=https://omnibot.<subdomain>.workers.dev npm run set-webhooks
   npm run register-discord
   ```

7. Trong Discord Developer Portal, mở **General Information** và đặt **Interactions Endpoint URL** là `https://omnibot.<subdomain>.workers.dev/webhook/discord`. Discord kiểm tra endpoint khi lưu, nên Worker phải được deploy trước.

8. Gửi `/ping` cho bot trên từng nền tảng.

## Secret cục bộ

Wrangler không đọc lại được giá trị secret đã deploy, nên script và `npm run dev` đọc từ file `.dev.vars` ở local. File dùng cú pháp dotenv:

```bash
WEBHOOK_SECRET="..."
ZALO_BOT_TOKEN="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_USERNAME="your_bot"
DISCORD_APP_ID="..."
DISCORD_PUBLIC_KEY="..."
DISCORD_BOT_TOKEN="..."
```

Dùng `.dev.vars` hoặc `.env`, không dùng cả hai. Nếu có `.dev.vars` thì Wrangler không nạp `.env`. Không được commit file nào trong hai file này.

## Script

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy local tại `http://localhost:8787` |
| `npm run deploy` | Deploy lên Cloudflare |
| `npm run set-webhooks` | Đăng ký webhook Zalo và Telegram |
| `npm run register-discord` | Ghi đè global command của Discord |
| `npm run tail` | Xem log realtime bằng `wrangler tail` |
| `npm run lint` | Chạy ESLint |
| `npm test` | Chạy test |

### Yêu cầu với `set-webhooks`

- Bỏ qua nền tảng thiếu token, và in ra là đã bỏ qua.
- Truyền `secret_token` cho cả hai nền tảng.
- Với Telegram, truyền `allowed_updates: ["message"]`.
- Với Zalo, kiểm tra kết quả `verification` là `webhook.ok`, nếu không thì báo lỗi. Zalo vẫn lưu URL dù verification thất bại.
- Không in giá trị secret nào.

### Yêu cầu với `register-discord`

- Dùng `PUT /applications/{app_id}/commands` để ghi đè danh sách global, nhờ đó lệnh đã xoá sẽ biến mất.
- Tạo danh sách từ `src/commands/index.ts` để không bị lệch với code.
- Chỉ chạy khi lệnh thay đổi. Discord giới hạn 200 lượt tạo lệnh mỗi ngày trên mỗi guild.

`PUT` thay thế **toàn bộ** global command của application, kể cả lệnh tạo ngoài repo này.

## Phát triển local

```bash
npm run dev
cloudflared tunnel --url http://localhost:8787
WORKER_URL=https://<tunnel-host> npm run set-webhooks
```

Nền tảng không gọi được `localhost`, và Zalo từ chối rõ ràng địa chỉ này, nên test local cần tunnel.

**Chạy `set-webhooks` với URL tunnel sẽ thay thế webhook production của bot đó.** Hãy dùng bot riêng cho dev. Nếu dùng bot production, hãy chạy lại `set-webhooks` với URL của Worker khi xong.

## Giới hạn free tier

| Tài nguyên | Giới hạn | Hệ quả |
| --- | --- | --- |
| Request | 100.000 mỗi ngày, reset lúc nửa đêm UTC | Vượt mức sẽ trả Error 1027 |
| CPU time | 10 ms mỗi HTTP request | Tránh parse và tính toán nặng |
| Startup | 1 giây cho global scope, lỗi `Script startup exceeded CPU time limit` | Không tạo object lớn ở top level |
| Kích thước Worker | 64 MiB chưa nén | Kiểm tra bằng `npx wrangler deploy --outdir bundled/ --dry-run` |
| Subrequest | 50 mỗi invocation | Reply dài tốn một subrequest cho mỗi chunk |
| `waitUntil` | 30 giây sau response, dùng chung trong một request | Đặt timeout cho lời gọi ra ngoài |
| Lượt đọc KV | 100.000 mỗi ngày | |
| Lượt ghi KV | 1.000 mỗi ngày trên các key khác nhau, 1 mỗi giây trên một key | Không ghi theo từng tin nhắn |
| Key / value KV | 512 byte / 25 MiB | |
| Lan truyền KV | Từ 60 giây trở lên | Không dựa vào đọc ngay sau khi ghi |

Webhook Telegram cũng phải dùng cổng 443, 80, 88 hoặc 8443. URL `workers.dev` mặc định dùng 443.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân có thể | Cách xử lý |
| --- | --- | --- |
| Route trả 404 | Adapter đang tắt | Kiểm tra các giá trị bắt buộc trong [adapters.md](adapters.md) |
| Route trả 401 | Secret không khớp | Chạy lại `set-webhooks` sau khi đổi `WEBHOOK_SECRET` |
| Discord từ chối endpoint URL | Kiểm tra chữ ký hoặc `PING` thất bại | Kiểm tra `DISCORD_PUBLIC_KEY` và phần xử lý `PONG` |
| Discord hiện "thinking" mãi không trả lời | `reply` lỗi trong `waitUntil` | Chạy `npm run tail` và tìm `reply_failed` |
| Không thấy slash command | Chưa đăng ký lệnh | Chạy `npm run register-discord` |
| `setWebhook` của Telegram từ chối secret | Có ký tự không hợp lệ | Xem định dạng trong [security.md](security.md) |
