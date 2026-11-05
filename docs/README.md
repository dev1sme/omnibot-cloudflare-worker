# Chuẩn kỹ thuật của omnibot

Bộ tài liệu này quy định cách xây dựng omnibot. Code, review và AI agent đều phải tuân theo.

Repo chưa có code, nên đây là spec được viết trước khi implement.

## Danh sách tài liệu

| Tài liệu | Phạm vi |
| --- | --- |
| [architecture.md](architecture.md) | Các layer, quy tắc phụ thuộc, vòng đời request |
| [contracts.md](contracts.md) | Type dùng chung, hành vi HTTP, cơ chế delivery |
| [adapters.md](adapters.md) | Yêu cầu theo từng nền tảng, cách thêm nền tảng |
| [commands.md](commands.md) | Cách viết và đăng ký lệnh |
| [security.md](security.md) | Xác minh webhook, secret, logging |
| [operations.md](operations.md) | Cài đặt, deploy, phát triển local, giới hạn nền tảng |
| [conventions.md](conventions.md) | Code style, test, commit, Definition of Done |

## Cách đọc quy tắc

- **PHẢI** và **KHÔNG ĐƯỢC** là bắt buộc. Muốn làm khác thì phải sửa tài liệu trước.
- **NÊN** là mặc định. Muốn làm khác thì phải nêu lý do trong pull request.
- **CÓ THỂ** là tuỳ chọn.

## Nguồn chuẩn

1. Nếu các tài liệu mâu thuẫn nhau, `contracts.md` được ưu tiên về type và hành vi HTTP. `security.md` được ưu tiên về bảo mật.
2. Bộ tài liệu này được ưu tiên hơn `README.md` ở thư mục gốc, vốn chỉ là phần giới thiệu và quick start.
3. Nếu code và tài liệu khác nhau thì đó là lỗi. Hãy sửa code, hoặc sửa tài liệu trong cùng pull request.

## Trạng thái

Cập nhật bảng này trong pull request làm thay đổi trạng thái của thành phần.

| Thành phần | Trạng thái |
| --- | --- |
| Entry point, Hono routes và pipeline | Planned |
| Router lệnh | Planned |
| `/ping`, `/help` | Planned |
| Adapter Zalo | Planned |
| Adapter Telegram | Planned |
| Adapter Discord (slash command) | Planned |
| Script `set-webhooks`, `register-discord` | Planned |

## Thông tin từ bên ngoài

Thông tin về các nền tảng được đối chiếu với tài liệu chính thức vào ngày 2026-11-05. Nền tảng có thể thay đổi, nên hãy kiểm tra lại trước khi dựa vào chúng cho việc mới.

| Nền tảng | Tài liệu tham khảo |
| --- | --- |
| Zalo | <https://bot.zaloplatforms.com/docs/> |
| Telegram | <https://core.telegram.org/bots/api> |
| Discord | <https://docs.discord.com/developers/interactions/overview> |
| Cloudflare Workers | <https://developers.cloudflare.com/workers/platform/limits/> |
| Cloudflare KV | <https://developers.cloudflare.com/kv/platform/limits/> |

Các mục sau chưa được xác nhận. Hãy xác nhận từng mục khi implement, rồi xoá mục đó khỏi danh sách.

- Zalo không ghi rõ chính sách retry webhook, deadline phản hồi, hay bộ ký tự của `secret_token`.
- Zalo không nói rõ `sendMessage` có hoạt động trong group chat hay không.
- Các trang interaction của Discord không nêu giới hạn độ dài nội dung. Con số 2000 ký tự lấy từ tài liệu message resource.
- Các trang interaction của Discord không thể hiện header `Authorization` trong lời gọi follow-up. Cần xác nhận chỉ dùng interaction token là đủ.
- Giới hạn 4096 ký tự của Telegram và dạng `/command@botname` được đọc từ bản tóm tắt của tool, chưa đối chiếu nguyên văn.
- Cần kiểm tra đường dẫn chính xác của object `verification` trong response `setWebhook` của Zalo.
- Tài liệu `discord-interactions` không nêu hỗ trợ Workers, và trang đã đọc của Cloudflare không nêu Ed25519 trong `crypto.subtle`. Mã nguồn thư viện có nhánh dành cho Workers, nhưng cần test thật.
- Tài liệu grammY không nói rõ `Api` dùng độc lập được, và không nói lỗi có chứa token hay URL hay không. Cần kiểm tra mã nguồn và test trên Workers.
- `grammy` phụ thuộc `node-fetch` và `abort-controller`. Cần đo bundle và CPU với giới hạn 10 ms của free tier.
- Trang Hono đã đọc không nhắc `c.executionCtx`. Cần xác nhận trong API docs của Hono.
