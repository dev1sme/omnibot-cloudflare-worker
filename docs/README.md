# omnibot

omnibot là một Cloudflare Worker duy nhất điều khiển nhiều bot chat: Zalo, Telegram, Discord. Logic chỉ viết một lần và chạy trên mọi nền tảng, không cần server hay VPS, và chạy được trên free tier của Cloudflare Workers.

Đây là nơi duy nhất chứa chi tiết về dự án. Bộ tài liệu này quy định cách xây dựng omnibot, và code, review, AI agent đều phải tuân theo. Code đã được implement theo bộ tài liệu này, nhưng chưa chạy với bot thật.

## Tính năng

- **Một codebase, nhiều nền tảng.** Lệnh như `/ping`, `/help` viết một lần, bot nào cũng hiểu.
- **Kiến trúc adapter.** Thêm nền tảng mới chỉ cần thêm một adapter.
- **Serverless.** Chạy bằng webhook trên Cloudflare Workers.
- **Bảo mật webhook.** Xác minh secret token (Zalo, Telegram) và chữ ký Ed25519 (Discord).
- **Lưu trạng thái** bằng Cloudflare KV, có thể đổi sang D1 hoặc Durable Objects.
- **Tác vụ nền.** Dùng `ctx.waitUntil()` để trả lời nền tảng ngay rồi xử lý lâu phía sau.

## Bắt đầu

- Cài đặt và deploy: [operations.md](operations.md#deploy-lần-đầu)
- Viết lệnh mới: [commands.md](commands.md)
- Thêm nền tảng mới: [adapters.md](adapters.md#thêm-nền-tảng)
- Đóng góp: [conventions.md](conventions.md#branch-và-pull-request)

## Danh sách tài liệu

| Tài liệu | Phạm vi |
| --- | --- |
| [architecture.md](architecture.md) | Các layer, quy tắc phụ thuộc, vòng đời request |
| [contracts.md](contracts.md) | Type dùng chung, hành vi HTTP, cơ chế delivery |
| [adapters.md](adapters.md) | Yêu cầu theo từng nền tảng, cách thêm nền tảng |
| [commands.md](commands.md) | Cách viết lệnh, nội dung trả lời, phân quyền |
| [security.md](security.md) | Xác minh webhook, secret, logging |
| [operations.md](operations.md) | Môi trường, deploy, CI/CD, phát triển local, giới hạn nền tảng |
| [conventions.md](conventions.md) | Code style, thư viện, logging, test, commit, Definition of Done |
| [decisions.md](decisions.md) | Lý do của các quyết định quan trọng |

## Cách đọc quy tắc

- **PHẢI** và **KHÔNG ĐƯỢC** là bắt buộc. Muốn làm khác thì phải sửa tài liệu trước.
- **NÊN** là mặc định. Muốn làm khác thì phải nêu lý do trong pull request.
- **CÓ THỂ** là tuỳ chọn.

## Nguồn chuẩn

1. Nếu các tài liệu mâu thuẫn nhau, `contracts.md` được ưu tiên về type và hành vi HTTP. `security.md` được ưu tiên về bảo mật.
2. `README.md` ở thư mục gốc chỉ giới thiệu ngắn và trỏ về đây. Chi tiết chỉ nằm trong `docs/`.
3. Nếu code và tài liệu khác nhau thì đó là lỗi. Hãy sửa code, hoặc sửa tài liệu trong cùng pull request.

## Trạng thái

Cập nhật bảng này trong pull request làm thay đổi trạng thái của thành phần.

| Thành phần | Trạng thái |
| --- | --- |
| Entry point, Hono routes và pipeline | Implemented |
| Router lệnh | Implemented |
| `/ping`, `/help` | Implemented |
| Adapter Zalo | Implemented, chưa test với bot thật |
| Adapter Telegram | Implemented, chưa test với bot thật |
| Adapter Discord (slash command) | Implemented, chưa test với bot thật |
| Script `set-webhooks`, `register-discord` | Implemented, chưa chạy với API thật |
| Môi trường dev | Cấu hình xong, cần KV id thật trong `wrangler.toml` |
| CI/CD | Đã có workflow, chưa chạy lần nào |
| Lệnh admin | Cơ chế phân quyền đã có, chưa có lệnh nào |

## Roadmap

- [ ] Zalo, Telegram, Discord (slash command)
- [ ] Gửi/nhận ảnh và file
- [ ] Tích hợp AI (Claude, Workers AI) cho chế độ chat tự do
- [ ] Broadcast: gửi một tin đến tất cả nền tảng cùng lúc
- [ ] Dashboard quản lý
- [ ] Adapter Messenger, Slack

## Thông tin từ bên ngoài

Thông tin về các nền tảng được đối chiếu với tài liệu chính thức vào ngày 2026-11-05. Nền tảng có thể thay đổi, nên hãy kiểm tra lại trước khi dựa vào chúng cho việc mới.

| Nền tảng | Tài liệu tham khảo |
| --- | --- |
| Zalo | <https://bot.zaloplatforms.com/docs/> |
| Telegram | <https://core.telegram.org/bots/api> |
| Discord | <https://docs.discord.com/developers/interactions/overview> |
| Cloudflare Workers | <https://developers.cloudflare.com/workers/platform/limits/> |
| Cloudflare KV | <https://developers.cloudflare.com/kv/platform/limits/> |

Các mục sau đã được xác nhận khi implement, bằng test trong Workers runtime hoặc chạy thử:

- `verifyKey` của `discord-interactions` xác minh đúng chữ ký Ed25519 thật.
- `Api` của grammY chạy độc lập, và `GrammyError` có `error_code` cùng `parameters.retry_after`.
- `HttpError` của grammY giữ lỗi gốc trong `error`, nên có thể chứa URL có token nếu lỗi gốc chứa URL. Adapter không để lỗi này đi ra ngoài.
- Bundle thử nghiệm với cả 4 thư viện là khoảng 168 KiB, chưa nén.
- `tsx --env-file` nạp được biến, và báo lỗi khi thiếu file.
- `wrangler secret put` có cờ `--env`, và `wrangler rollback` tồn tại.

Các mục sau chưa được xác nhận. Hãy xác nhận từng mục khi chạy với bot thật, rồi xoá mục đó khỏi danh sách.

- Zalo không ghi rõ chính sách retry webhook, deadline phản hồi, hay bộ ký tự của `secret_token`.
- Zalo không nói rõ `sendMessage` có hoạt động trong group chat hay không.
- Cần kiểm tra đường dẫn chính xác của object `verification` trong response `setWebhook` của Zalo. Script hiện chấp nhận cả hai vị trí.
- Các trang interaction của Discord không nêu giới hạn độ dài nội dung. Con số 2000 ký tự lấy từ tài liệu message resource.
- Các trang interaction của Discord không thể hiện header `Authorization` trong lời gọi follow-up. Cần xác nhận chỉ dùng interaction token là đủ.
- Giới hạn 4096 ký tự của Telegram và dạng `/command@botname` được đọc từ bản tóm tắt của tool, chưa đối chiếu nguyên văn.
- Giới hạn 10 ms CPU của free tier chưa đo được, vì test local không phản ánh đúng. Cần đo sau khi deploy, nhất là với `grammy`.
