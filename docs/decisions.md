# Nhật ký quyết định

Ghi lại lý do của các quyết định khó đoán nếu chỉ đọc quy tắc. Tài liệu khác nói **phải làm gì**, tài liệu này nói **vì sao**.

Khi thay đổi một quyết định, không xoá mục cũ. Đổi trạng thái của nó thành `Superseded` và thêm mục mới.

| ID | Quyết định | Vì sao | Phương án đã bỏ | Trạng thái |
| --- | --- | --- | --- | --- |
| D1 | Pipeline đọc raw body một lần, rồi truyền chuỗi cho `verify` và `parse` | Body chỉ đọc được một lần, và chữ ký Discord cần byte gốc | `verify(req)` và `parse(req)` cùng đọc `Request` | Active |
| D2 | Mọi lệnh chạy trong `waitUntil`, sau khi đã ack | Discord huỷ token sau 3 giây, và lệnh không cam kết được thời gian chạy | Chỉ chạy nền khi lệnh chậm, vì không biết trước lệnh nào chậm | Active |
| D3 | Không có deduplication toàn cục | KV eventually consistent và free tier chỉ có 1.000 lượt ghi mỗi ngày | Dedupe bằng KV | Active |
| D4 | Lệnh không tồn tại vẫn được trả lời | Lệnh Discord cũ sẽ kẹt ở trạng thái loading nếu bị bỏ qua | Bỏ qua im lặng. Cái giá là có thể thừa tin trả lời trong group Telegram nhiều bot | Active |
| D5 | Worker không giữ `DISCORD_BOT_TOKEN` | Chỉ script cần token này, nên giữ trên Worker chỉ làm tăng rủi ro | Đưa mọi secret lên Worker | Active |
| D6 | Ưu tiên thư viện, không tự viết crypto | Giảm code phải bảo trì và rủi ro bảo mật | Giữ dependency ở mức tối thiểu | Active |
| D7 | Chọn Valibot | Nhẹ hơn Zod, phù hợp giới hạn CPU và startup của Workers | Zod | Active |
| D8 | Chỉ dùng `Api` của grammY và `verifyKey` của `discord-interactions` | `Bot`, `webhookCallback` và middleware kiểu Express không hợp với pipeline | Dùng cả framework của SDK | Active, cần test trên Workers |
| D9 | Zalo dùng client mỏng tự viết | Chỉ có SDK cộng đồng chưa đánh giá, chúng sẽ giữ bot token, và omnibot chỉ cần hai API | Dùng SDK cộng đồng | Active |
| D10 | Mỗi nền tảng một thư mục trong `src/adapters/` | Thêm nền tảng không phải sửa code của nền tảng khác | Một file cho mỗi adapter | Active |
| D11 | Response envelope theo chuẩn của `project-member-status` | Thống nhất format giữa các dự án, thuận tiện debug và làm API sau này | Format `{ ok }` riêng | Active |
| D12 | Protocol nền tảng không bọc envelope | Bọc vào sẽ làm hỏng Discord `PING` và ack | Bọc mọi response | Active |
| D13 | JSON dùng `snake_case`, code dùng `camelCase` | Khớp với payload nền tảng và `project-member-status`, mà code vẫn đúng kiểu TypeScript | Dùng một kiểu cho cả hai | Active |
| D14 | Top-level của `wrangler.toml` là production, `[env.dev]` là dev | URL production giữ dạng `omnibot.<subdomain>.workers.dev` | Thêm `[env.production]` | Active |
| D15 | Không retry lỗi gửi tin, trừ `429` có thời gian chờ từ nền tảng | Retry lỗi khác có thể gửi trùng tin, và `waitUntil` chỉ có 30 giây | Retry mọi lỗi | Active |
| D16 | Lỗi được log qua `PlatformError`, không log `message` của SDK | URL API của Zalo và Telegram chứa bot token | Log nguyên object lỗi | Active |
| D17 | Quyền admin kiểm tra phía server bằng `ADMIN_USER_IDS` | Một danh sách dùng được cho mọi nền tảng, và fail closed khi thiếu cấu hình | Dựa vào quyền hiển thị lệnh của từng nền tảng | Active, chưa có lệnh admin |
| D18 | Nội dung trả lời gom vào `src/messages/`, chưa dùng thư viện i18n | Hiện chỉ có một ngôn ngữ, nhưng thêm ngôn ngữ sau này không phải sửa từng lệnh | Viết text trực tiếp trong lệnh, hoặc cài i18n ngay | Active |
| D19 | `README.md` ở root chỉ trỏ về `docs/` | Mỗi thông tin chỉ nằm ở một nơi, tránh hai bản bị lệch nhau | Giữ quick start và các bảng trong README ở root | Active |
