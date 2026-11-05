# omnibot

Một Cloudflare Worker chạy bot chat trên Zalo, Telegram và Discord.

Các chuẩn trong `docs/` là bắt buộc. Hãy bắt đầu từ `docs/README.md`, nơi giải thích từ khoá quy tắc và tài liệu nào được ưu tiên khi có mâu thuẫn.

## Đọc trước khi sửa

| Việc | Cần đọc |
| --- | --- |
| Pipeline, route hoặc type | `docs/architecture.md`, `docs/contracts.md` |
| Adapter hoặc nền tảng mới | `docs/adapters.md`, `docs/security.md` |
| Lệnh | `docs/commands.md` |
| Deploy, secret hoặc script | `docs/operations.md`, `docs/security.md` |
| Mọi thay đổi code | `docs/conventions.md` |
| Muốn đổi một quy tắc | `docs/decisions.md` |

## Các quy tắc dễ vi phạm

- Đọc request body một lần trong pipeline. Verify trước khi parse.
- Command không được import adapter, và adapter không được import adapter khác.
- Ưu tiên thư viện trong `docs/conventions.md` thay vì tự viết. Không tự viết crypto.
- Mỗi nền tảng nằm gọn trong `src/adapters/<name>/`.
- Acknowledge trước, rồi chạy lệnh trong `ctx.waitUntil()`.
- Không bao giờ log URL API của nền tảng. URL của Zalo và Telegram chứa bot token.
- Không dùng KV cho deduplication, counter hoặc lock.
- Log qua `src/lib/log.ts`, không gọi `console` trực tiếp, không log `error.message`.
- Nội dung gửi cho người dùng nằm trong `src/messages/`.
- Không chạy `npm run set-webhooks` với URL tunnel, dùng `set-webhooks:dev`.
- Tạo response bằng `ok()` và `fail()`. Chỉ protocol của nền tảng, như Discord `PING` và ack, mới không dùng envelope.
- Nếu code và `docs/` khác nhau, hãy sửa một trong hai trong cùng thay đổi, và cập nhật bảng trạng thái trong `docs/README.md`.

## Lệnh

```bash
npm run dev
npm run lint
npm test
```
