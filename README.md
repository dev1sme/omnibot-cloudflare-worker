# 🤖 omnibot

Một Cloudflare Worker duy nhất điều khiển nhiều bot chat: **Zalo**, **Telegram**, **Discord**. Viết logic một lần, chạy trên mọi nền tảng.

Không cần server hay VPS, và chạy được trên free tier của Cloudflare Workers.

> **Trạng thái:** đã có code và test, nhưng chưa chạy với bot thật.

## ✨ Tính năng

- **Một codebase, nhiều nền tảng:** lệnh như `/ping`, `/help` viết một lần, bot nào cũng hiểu.
- **Dễ mở rộng:** thêm nền tảng mới như Slack chỉ cần thêm một adapter.
- **Serverless:** nhận tin qua webhook, trả lời nền tảng ngay rồi xử lý phía sau.
- **Bảo mật webhook:** xác minh secret token (Zalo, Telegram) và chữ ký Ed25519 (Discord).

## 🧭 Cách hoạt động

```
Zalo / Telegram / Discord  →  Adapter  →  Router lệnh  →  Lệnh  →  Adapter  →  Trả lời
```

Adapter xử lý mọi khác biệt của nền tảng, nên lệnh không cần biết tin nhắn đến từ đâu.

## 📚 Tài liệu

Chi tiết về dự án nằm trong [`docs/`](docs/README.md):

| Muốn làm gì | Đọc |
| --- | --- |
| Tổng quan, roadmap, trạng thái | [docs/README.md](docs/README.md) |
| Cài đặt và deploy | [docs/operations.md](docs/operations.md) |
| Hiểu kiến trúc | [docs/architecture.md](docs/architecture.md) |
| Viết lệnh mới | [docs/commands.md](docs/commands.md) |
| Thêm nền tảng | [docs/adapters.md](docs/adapters.md) |
| Đóng góp | [docs/conventions.md](docs/conventions.md) |

## 📄 License

MIT
