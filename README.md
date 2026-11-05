# 🤖 omnibot

Một Cloudflare Worker duy nhất điều khiển nhiều bot chat: **Zalo**, **Telegram**, **Discord**. Viết logic một lần, chạy trên mọi nền tảng.

Không cần server, không cần VPS. Chạy trên free tier của Cloudflare Workers.

> **Trạng thái:** dự án đang ở giai đoạn thiết kế và chưa có code. README mô tả hệ thống đích. Tiến độ từng phần nằm trong [docs/README.md](docs/README.md).

📚 **Chuẩn kỹ thuật:** toàn bộ quy tắc xây dựng dự án nằm trong [`docs/`](docs/README.md). Nếu README và `docs/` khác nhau thì theo `docs/`.

---

## ✨ Tính năng

- **Một codebase, nhiều nền tảng.** Lệnh `/ping`, `/help`... viết một lần, bot nào cũng hiểu.
- **Kiến trúc adapter.** Muốn thêm nền tảng mới (Messenger, Slack, Line...) thì chỉ cần viết thêm một adapter.
- **Serverless.** Chạy bằng webhook trên Cloudflare Workers, phản hồi nhanh ở edge.
- **Bảo mật webhook.** Xác minh secret token (Zalo, Telegram) và chữ ký Ed25519 (Discord).
- **Lưu trạng thái** bằng Cloudflare KV (có thể đổi sang D1 hoặc Durable Objects).
- **Tác vụ nền.** Dùng `ctx.waitUntil()` để trả lời nền tảng ngay rồi xử lý lâu (gọi AI, API ngoài) phía sau.

---

## 🧭 Kiến trúc

```
 Zalo ──────┐
            │  POST /webhook/zalo
 Telegram ──┼──────────────────────►  Cloudflare Worker
            │  POST /webhook/telegram        │
 Discord ───┘  POST /webhook/discord         ▼
                                    ┌──────────────────┐
                                    │  Adapter          │  chuẩn hoá tin nhắn
                                    │  (zalo/tg/discord)│  → IncomingMessage
                                    └────────┬─────────┘
                                             ▼
                                    ┌──────────────────┐
                                    │  Router lệnh      │  /ping, /help, ...
                                    └────────┬─────────┘
                                             ▼
                                    ┌──────────────────┐
                                    │  Adapter.reply()  │  gọi API của nền tảng
                                    └──────────────────┘
```

Mỗi nền tảng có một **adapter** làm 3 việc:

1. **Xác minh** request có thật sự đến từ nền tảng đó không.
2. **Chuẩn hoá** payload thành một `IncomingMessage` chung.
3. **Gửi trả lời** bằng API riêng của nền tảng.

Phần logic (commands) không cần biết tin nhắn đến từ đâu. Chi tiết xem [docs/architecture.md](docs/architecture.md).

---

## 📁 Cấu trúc thư mục

Xem [docs/architecture.md](docs/architecture.md#cấu-trúc-thư-mục).

---

## 🚀 Bắt đầu nhanh

### 1. Yêu cầu

- Node.js bản đang được hỗ trợ (Current, Active hoặc Maintenance)
- Tài khoản Cloudflare

Wrangler được cài cục bộ trong dự án qua `npm install` và chạy bằng `npx wrangler`.

### 2. Cài đặt

```bash
git clone https://github.com/dev1sme/omnibot-cloudflare-worker.git
cd omnibot-cloudflare-worker
npm install
npx wrangler login
```

### 3. Tạo bot trên từng nền tảng

| Nền tảng | Lấy token ở đâu | Cần lưu |
|---|---|---|
| **Zalo** | [bot.zaloplatforms.com](https://bot.zaloplatforms.com) | Bot token |
| **Telegram** | Chat với [@BotFather](https://t.me/BotFather), gõ `/newbot` | Bot token, username của bot |
| **Discord** | [Discord Developer Portal](https://discord.com/developers/applications) | Application ID, Public Key, Bot token |

Không cần dùng cả 3. Nền tảng nào thiếu cấu hình thì Worker tắt nền tảng đó, và route của nó trả về 404.

### 4. Cấu hình secrets

```bash
# Chung (chỉ dùng A-Z, a-z, 0-9, _ và -, dài 8–256 ký tự)
openssl rand -hex 32                          # tạo giá trị ngẫu nhiên
npx wrangler secret put WEBHOOK_SECRET

# Zalo
npx wrangler secret put ZALO_BOT_TOKEN

# Telegram
npx wrangler secret put TELEGRAM_BOT_TOKEN

# Discord
npx wrangler secret put DISCORD_APP_ID
npx wrangler secret put DISCORD_PUBLIC_KEY
```

`DISCORD_BOT_TOKEN` chỉ dùng cho script `register-discord`, nên **không** đưa lên Worker.

Các script chạy trên máy local không đọc được secret đã deploy, nên cần thêm file `.dev.vars` (không commit). Xem [docs/operations.md](docs/operations.md#secret-cục-bộ).

Tạo KV namespace để lưu trạng thái:

```bash
npx wrangler kv namespace create OMNIBOT_KV
```

Dán `id` vừa nhận được vào `wrangler.toml`:

```toml
name = "omnibot"
main = "src/index.ts"
compatibility_date = "2026-11-01"

[vars]
TELEGRAM_BOT_USERNAME = "<username-bot-cua-ban>"

[[kv_namespaces]]
binding = "OMNIBOT_KV"
id = "<kv-id-cua-ban>"
```

### 5. Deploy

```bash
npm run deploy
# → https://omnibot.<subdomain>.workers.dev
```

### 6. Đăng ký webhook

```bash
WORKER_URL=https://omnibot.<subdomain>.workers.dev npm run set-webhooks
npm run register-discord
```

Script `set-webhooks` sẽ trỏ:

- Zalo về `https://.../webhook/zalo`
- Telegram về `https://.../webhook/telegram`

Discord phải cấu hình thủ công một lần: vào Developer Portal, mở **General Information**, điền **Interactions Endpoint URL** là `https://.../webhook/discord`.

Xong! Nhắn `/ping` cho bot trên bất kỳ nền tảng nào.

---

## 🧩 Viết lệnh mới

Tạo file `src/commands/hello.ts`:

```ts
import type { Command } from "../core/types";

export const hello: Command = {
  name: "hello",
  description: "Chào người dùng",
  async run(msg) {
    return `Xin chào ${msg.user.name ?? "bạn"} từ ${msg.platform}! 👋`;
  },
};
```

Rồi đăng ký trong `src/commands/index.ts`:

```ts
import { hello } from "./hello";
export const commands = [ping, help, hello];
```

Lệnh này tự chạy trên cả Zalo, Telegram và Discord. Riêng với Discord, cần chạy lại `npm run register-discord` để slash command mới xuất hiện. Quy tắc đầy đủ xem [docs/commands.md](docs/commands.md).

---

## 🔌 Thêm nền tảng mới

Tạo thư mục `src/adapters/<name>/` và thêm adapter vào danh sách trong `src/adapters/index.ts`. Route `/webhook/<name>` sẽ tự hoạt động.

Interface xem [docs/contracts.md](docs/contracts.md), các bước xem [docs/adapters.md](docs/adapters.md#thêm-nền-tảng).

---

## ⚠️ Giới hạn theo nền tảng

| | Zalo | Telegram | Discord |
|---|---|---|---|
| Cơ chế | Webhook | Webhook | Interactions (HTTP) |
| Xác minh | Header `X-Bot-Api-Secret-Token` | Header `X-Telegram-Bot-Api-Secret-Token` | Chữ ký Ed25519 |
| Độ dài tin nhắn | 2000 ký tự | 4096 ký tự | 2000 ký tự |
| Nhóm | Chưa hỗ trợ (Zalo đang Beta) | Có | Có (server) |
| Đọc mọi tin nhắn | Có (chat 1-1) | Có | ❌ Chỉ slash command |

**Lưu ý quan trọng:**

- **Discord:** Worker chỉ nhận được **slash command** (`/ping`) qua Interactions Endpoint. Muốn bot đọc mọi tin nhắn trong kênh thì cần kết nối Gateway (WebSocket chạy liên tục). Workers không phù hợp cho việc này; cần một server riêng hoặc Durable Objects.
- **Discord:** phải phản hồi trong vòng 3 giây. Vì vậy adapter luôn trả `DEFERRED` trước rồi gửi kết quả sau.
- **Polling:** Worker không chạy liên tục, nên **không dùng được** `getUpdates` hay long-polling. Chỉ dùng webhook.
- **Zalo:** repo này dùng **Zalo Bot Platform** chính thức. Không hỗ trợ điều khiển tài khoản Zalo cá nhân, vì cách đó vi phạm điều khoản và có nguy cơ bị khóa tài khoản.

---

## 🛠️ Phát triển local

```bash
npm run dev          # wrangler dev, chạy tại http://localhost:8787
```

Để nền tảng gọi được vào máy local, dùng tunnel:

```bash
cloudflared tunnel --url http://localhost:8787
```

Sau đó chạy lại `set-webhooks` với URL tunnel.

**Lưu ý:** bước này thay thế webhook production của bot. Nên dùng bot riêng cho môi trường dev.

---

## 📜 Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy local |
| `npm run deploy` | Deploy lên Cloudflare |
| `npm run set-webhooks` | Đăng ký webhook Zalo + Telegram |
| `npm run register-discord` | Đăng ký slash command Discord |
| `npm run tail` | Xem log realtime (`wrangler tail`) |
| `npm run lint` | Chạy ESLint |
| `npm test` | Chạy test |

---

## 🗺️ Roadmap

- [ ] Zalo, Telegram, Discord (slash command)
- [ ] Gửi/nhận ảnh và file
- [ ] Tích hợp AI (Claude, Workers AI) cho chế độ chat tự do
- [ ] Broadcast: gửi một tin đến tất cả nền tảng cùng lúc
- [ ] Dashboard quản lý
- [ ] Adapter Messenger, Slack

---

## 🤝 Đóng góp

PR và issue luôn được chào đón. Trước khi gửi PR, hãy đọc [docs/conventions.md](docs/conventions.md) và chạy `npm run lint && npm test`.

## 📄 License

MIT
