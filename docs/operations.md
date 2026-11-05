# Vận hành

## Yêu cầu

- Node.js bản đang ở trạng thái Current, Active hoặc Maintenance. Wrangler hỗ trợ các bản này và tài liệu không nêu con số tối thiểu cố định.
- Tài khoản Cloudflare.
- Wrangler là `devDependency` của dự án, chạy bằng `npx wrangler`. Không cài global. Cloudflare khuyến nghị cài local để cả dự án dùng chung một phiên bản.

## Tạo bot

Không cần dùng cả 3 nền tảng.

| Nền tảng | Lấy token ở đâu | Cần lưu |
| --- | --- | --- |
| Zalo | [bot.zaloplatforms.com](https://bot.zaloplatforms.com) | Bot token |
| Telegram | Chat với [@BotFather](https://t.me/BotFather), gõ `/newbot` | Bot token, username của bot |
| Discord | [Discord Developer Portal](https://discord.com/developers/applications) | Application ID, Public Key, Bot token |

## Môi trường

| | Production | Dev |
| --- | --- | --- |
| Trong `wrangler.toml` | Top-level | `[env.dev]` |
| Tên Worker | `omnibot` | `omnibot-dev` |
| Secret deploy | `npx wrangler secret put <KEY>` | `npx wrangler secret put <KEY> --env dev` |
| File secret local | `.dev.vars.production` | `.dev.vars.dev` |
| Bot và KV | Riêng | Riêng |

Dev và production PHẢI dùng bot và KV khác nhau. Nếu dùng chung bot, chạy `set-webhooks` cho dev sẽ ghi đè webhook production.

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
| `ADMIN_USER_IDS` | Secret | Lệnh admin |
| `OMNIBOT_KV` | KV binding | Command |

`wrangler.toml`:

```toml
name = "omnibot"
main = "src/index.ts"
compatibility_date = "2026-11-01"

[observability]
enabled = true

[vars]
TELEGRAM_BOT_USERNAME = "your_bot"

[[kv_namespaces]]
binding = "OMNIBOT_KV"
id = "<production-kv-id>"

[env.dev.vars]
TELEGRAM_BOT_USERNAME = "your_dev_bot"

[[env.dev.kv_namespaces]]
binding = "OMNIBOT_KV"
id = "<dev-kv-id>"
```

- `vars`, `kv_namespaces` và secret không kế thừa từ top-level, nên `[env.dev]` phải khai báo lại.
- Giữ `compatibility_date` cố định. Chỉ đổi khi có chủ đích, và phải test sau khi đổi.

## Deploy lần đầu

Chạy các bước theo đúng thứ tự, trước hết cho dev rồi đến production. Đăng ký webhook cần URL đã deploy, và nền tảng gửi request kiểm tra nên secret phải có sẵn. Các lệnh dưới đây dành cho production. Với dev, thêm `--env dev` vào lệnh `wrangler` và dùng các script có hậu tố `:dev`.

1. Clone repo, cài dependency và đăng nhập:

   ```bash
   git clone https://github.com/dev1sme/omnibot-cloudflare-worker.git
   cd omnibot-cloudflare-worker
   npm install
   npx wrangler login
   ```

2. Tạo KV namespace, rồi chép `id` vào `wrangler.toml`:

   ```bash
   npx wrangler kv namespace create OMNIBOT_KV
   npx wrangler kv namespace create OMNIBOT_KV_DEV
   ```

3. Đặt secret cho các nền tảng sẽ dùng:

   ```bash
   npx wrangler secret put WEBHOOK_SECRET
   npx wrangler secret put ZALO_BOT_TOKEN
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put DISCORD_APP_ID
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put ADMIN_USER_IDS
   ```

4. Tạo `.dev.vars.production` với các giá trị script cần. Xem [Secret cục bộ](#secret-cục-bộ).

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

Sau lần đầu, production chỉ deploy qua CI. Xem [CI/CD](#cicd).

## Secret cục bộ

Wrangler không đọc lại được giá trị secret đã deploy, nên script và `npm run dev` đọc từ file local dùng cú pháp dotenv:

```bash
WEBHOOK_SECRET="..."
ZALO_BOT_TOKEN="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_USERNAME="your_bot"
DISCORD_APP_ID="..."
DISCORD_PUBLIC_KEY="..."
DISCORD_BOT_TOKEN="..."
ADMIN_USER_IDS="telegram:123456"
```

| File | Được dùng bởi |
| --- | --- |
| `.dev.vars.dev` | `npm run dev`, các script `:dev` |
| `.dev.vars.production` | `npm run set-webhooks`, `npm run register-discord` |

- `.dev.vars*` PHẢI có trong `.gitignore`. Không được commit các file này.
- Không tạo file `.dev.vars` chung. Khi có `.dev.vars.dev`, Wrangler chỉ nạp file đó trong môi trường dev.

## Script

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy local tại `http://localhost:8787`, dùng môi trường dev |
| `npm run deploy` | Deploy production. Chỉ dùng cho lần đầu hoặc khi CI gặp sự cố |
| `npm run deploy:dev` | Deploy dev |
| `npm run set-webhooks`, `set-webhooks:dev` | Đăng ký webhook Zalo và Telegram |
| `npm run register-discord`, `register-discord:dev` | Ghi đè global command của Discord |
| `npm run tail`, `tail:dev` | Xem log realtime bằng `wrangler tail` |
| `npm run lint` | Chạy ESLint |
| `npm test` | Chạy test |

Script TypeScript chạy bằng `tsx` và nạp secret bằng `--env-file`. Node.js báo lỗi nếu thiếu file, nên script không thể chạy nhầm với cấu hình rỗng.

```json
{
  "scripts": {
    "dev": "wrangler dev --env dev",
    "deploy": "wrangler deploy",
    "deploy:dev": "wrangler deploy --env dev",
    "tail": "wrangler tail",
    "tail:dev": "wrangler tail --env dev",
    "set-webhooks": "tsx --env-file=.dev.vars.production scripts/set-webhooks.ts",
    "set-webhooks:dev": "tsx --env-file=.dev.vars.dev scripts/set-webhooks.ts",
    "register-discord": "tsx --env-file=.dev.vars.production scripts/register-discord.ts",
    "register-discord:dev": "tsx --env-file=.dev.vars.dev scripts/register-discord.ts"
  }
}
```

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
WORKER_URL=https://<tunnel-host> npm run set-webhooks:dev
```

Nền tảng không gọi được `localhost`, và Zalo từ chối rõ ràng địa chỉ này, nên test local cần tunnel.

**KHÔNG ĐƯỢC chạy `npm run set-webhooks` với URL tunnel.** Lệnh đó dùng token production, nên sẽ thay thế webhook production. Với local, luôn dùng `set-webhooks:dev`.

## CI/CD

Dùng GitHub Actions.

| Sự kiện | Việc chạy |
| --- | --- |
| Mỗi pull request | `npm ci`, `npm run lint`, `npm test`, `npm audit`, `npx wrangler deploy --dry-run` |
| Push vào `main`, sau khi các bước trên pass | Deploy production bằng `cloudflare/wrangler-action@v4` |

```yaml
- uses: cloudflare/wrangler-action@v4
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Quy tắc:

- Production chỉ deploy từ `main`. `main` PHẢI được bảo vệ và yêu cầu CI pass.
- CI KHÔNG ĐƯỢC giữ bot token, và KHÔNG ĐƯỢC chạy `set-webhooks` hay `register-discord`. Chạy các lệnh này thủ công khi webhook hoặc lệnh thay đổi.
- Secret của Worker đặt bằng `wrangler secret put`, không đặt qua CI.
- NÊN yêu cầu duyệt tay bằng GitHub Environment `production` trước khi deploy.

Khi bản deploy có lỗi, chạy `npx wrangler rollback`, rồi sửa bằng pull request mới.

## Giới hạn free tier

| Tài nguyên | Giới hạn | Hệ quả |
| --- | --- | --- |
| Request | 100.000 mỗi ngày, reset lúc nửa đêm UTC | Vượt mức sẽ trả Error 1027 |
| CPU time | 10 ms mỗi HTTP request | Tránh parse và tính toán nặng |
| Startup | 1 giây cho global scope, lỗi `Script startup exceeded CPU time limit` | Không tạo object lớn ở top level |
| Kích thước Worker | 64 MiB chưa nén | Kiểm tra bằng `npx wrangler deploy --outdir bundled/ --dry-run` |
| Subrequest | 50 mỗi invocation | Reply dài tốn một subrequest cho mỗi chunk |
| `waitUntil` | 30 giây sau response, dùng chung trong một request | Đặt timeout cho lời gọi ra ngoài |
| Workers Logs đến hết 2026-11-30 | 200.000 log event mỗi ngày, lưu 3 ngày | Một request có một `console.log` tính là 2 event |
| Workers Logs từ 2026-12-01 | 0,5 GB mỗi ngày trên toàn account, lưu 7 ngày | Hết hạn mức thì ngừng ghi log đến 00:00 UTC, và không mua thêm được trên Free |
| Kích thước log | 256 KB | Không log payload lớn |
| Lượt đọc KV | 100.000 mỗi ngày | |
| Lượt ghi KV | 1.000 mỗi ngày trên các key khác nhau, 1 mỗi giây trên một key | Không ghi theo từng tin nhắn |
| Key / value KV | 512 byte / 25 MiB | |
| Lan truyền KV | Từ 60 giây trở lên | Không dựa vào đọc ngay sau khi ghi |

Webhook Telegram cũng phải dùng cổng 443, 80, 88 hoặc 8443. URL `workers.dev` mặc định dùng 443.

Hạn mức log từ 2026-12-01 dùng chung với mọi Worker và các dịch vụ observability khác trong account. Việc chuyển đổi là tự động, Worker vẫn phải tuân theo các quy tắc log trong [conventions.md](conventions.md#logging). `wrangler tail` xem log realtime và không lưu log.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân có thể | Cách xử lý |
| --- | --- | --- |
| Route trả 404 | Adapter đang tắt | Kiểm tra các giá trị bắt buộc trong [adapters.md](adapters.md) |
| Route trả 401 | Secret không khớp | Chạy lại `set-webhooks` sau khi đổi `WEBHOOK_SECRET` |
| Discord từ chối endpoint URL | Kiểm tra chữ ký hoặc `PING` thất bại | Kiểm tra `DISCORD_PUBLIC_KEY` và phần xử lý `PONG` |
| Discord hiện "thinking" mãi không trả lời | `reply` lỗi trong `waitUntil` | Chạy `npm run tail` và tìm `reply_failed` |
| Không thấy slash command | Chưa đăng ký lệnh | Chạy `npm run register-discord` |
| Log có `reply_failed` với `status` 429 | Bị rate limit quá ngân sách retry | Giảm số tin gửi hoặc độ dài nội dung |
| Webhook production trỏ tới tunnel | Chạy nhầm `set-webhooks` | Chạy lại `npm run set-webhooks` với URL production |
| Bản deploy mới bị lỗi | Lỗi trong code | Chạy `npx wrangler rollback` |
| `setWebhook` của Telegram từ chối secret | Có ký tự không hợp lệ | Xem định dạng trong [security.md](security.md) |
