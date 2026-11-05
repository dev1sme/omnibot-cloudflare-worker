# Adapter

Adapter chứa mọi thứ riêng của một nền tảng. Adapter implement contract `Adapter` trong [contracts.md](contracts.md).

## Tổng quan

| | Zalo | Telegram | Discord |
| --- | --- | --- | --- |
| Inbound | Webhook | Webhook | Interactions qua HTTP |
| Xác minh | `X-Bot-Api-Secret-Token` | `X-Telegram-Bot-Api-Secret-Token` | Chữ ký Ed25519 |
| Cần cho `isEnabled` | `ZALO_BOT_TOKEN`, `WEBHOOK_SECRET` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBHOOK_SECRET` | `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY` |
| Acknowledgement | `{"ok":true}` | `{"ok":true}` | `{"type":5}` |
| Giới hạn text | 2000 | 4096 | 2000 |
| Group chat trong omnibot | Không | Có | Có (server) |
| Thư viện gọi API | Client mỏng tự viết | grammY `Api` | `fetch`, kèm type từ `discord-api-types` |
| Thư viện verify | `secretEquals` | `secretEquals` | `discord-interactions` |

## Quy tắc chung

- Mỗi adapter nằm trong `src/adapters/<name>/`, với các file theo [architecture.md](architecture.md#cấu-trúc-thư-mục).
- `parse` PHẢI validate payload bằng schema trong `schema.ts`. Xem [contracts.md](contracts.md#validate-payload).
- `verify` PHẢI dùng helper và quy tắc trong [security.md](security.md).
- `reply` PHẢI gửi plain text. KHÔNG ĐƯỢC đặt `parse_mode` hay chế độ định dạng khác, vì kết quả lệnh có thể chứa nội dung người dùng nhập.
- `reply` PHẢI dùng `splitMessage(text, limit)` trong `src/lib/split-message.ts`.
- `reply` PHẢI kiểm tra HTTP status và trường `ok` của nền tảng nếu có, rồi throw khi thất bại.
- Adapter KHÔNG ĐƯỢC gọi `getUpdates` hay bất kỳ API polling nào.

### Chia nhỏ tin nhắn

`splitMessage` PHẢI:

- Đo độ dài bằng `string.length` (UTF-16 code unit). Giá trị này không bao giờ thấp hơn số ký tự, nên luôn nằm trong giới hạn.
- Ưu tiên ngắt ở dấu xuống dòng, sau đó đến dấu cách.
- Không bao giờ tách đôi surrogate pair.
- Không bao giờ trả về chunk rỗng.

## Zalo

API base: `https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/<method>`.

**Verify.** So sánh header `X-Bot-Api-Secret-Token` với `WEBHOOK_SECRET`.

**Parse.**

| Payload | Kết quả |
| --- | --- |
| `event_name` là `message.text.received` và `chat.chat_type` là `PRIVATE` | `message` |
| `chat.chat_type` là `GROUP` (Beta trên Zalo) | `ignore` |
| Mọi `event_name` khác, kể cả `message.unsupported.received` | `ignore` |

| `IncomingMessage` | Nguồn |
| --- | --- |
| `chatId` | `message.chat.id` |
| `user.id` | `message.from.id` |
| `user.name` | `message.from.display_name` |
| `text` | `message.text` |

**Reply.** `POST /sendMessage` với `chat_id` và `text`. Độ dài text PHẢI từ 1 đến 2000.

**Thư viện.** Không có SDK chính thức trong kết quả tìm kiếm ngày 2026-11-05, chỉ có package cộng đồng như `zalo-bot-js` và `zalo-bot-node-sdk`, chưa được đánh giá. Mặc định dùng client mỏng trong `client.ts`, vì package này sẽ giữ bot token và omnibot chỉ cần `sendMessage` với `setWebhook`.

## Telegram

API base: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/<method>`.

**Verify.** So sánh header `X-Telegram-Bot-Api-Secret-Token` với `WEBHOOK_SECRET`.

**Parse.** Chỉ trả `message` với update có cả `message.text` và `message.from`. Mọi update khác trả `ignore`.

| `IncomingMessage` | Nguồn |
| --- | --- |
| `chatId` | `String(message.chat.id)` |
| `user.id` | `String(message.from.id)` |
| `user.name` | `message.from.first_name` |
| `text` | `message.text`, chuẩn hoá như bên dưới |

**Chuẩn hoá mention bot.** So sánh mention với `TELEGRAM_BOT_USERNAME`, không phân biệt hoa thường.

| Đầu vào | Kết quả |
| --- | --- |
| `/ping` | `text` là `/ping` |
| `/ping@this_bot arg` | `text` là `/ping arg` |
| `/ping@other_bot` | `ignore` |

**Reply.** Gọi `sendMessage` qua grammY `Api`. Không reply qua webhook response: Telegram cho phép cách này, nhưng bot không biết được request có thành công hay không.

```ts
await new Api(env.TELEGRAM_BOT_TOKEN).sendMessage(msg.chatId, chunk);
```

**Thư viện.** Chỉ dùng class `Api` của grammY. KHÔNG ĐƯỢC dùng `Bot` hay `webhookCallback`, vì chúng chiếm luồng xử lý request và có timeout riêng 10 giây, trái với pipeline của omnibot. Nếu `Api` không chạy độc lập được trên Workers, thay bằng client mỏng trong `client.ts`.

## Discord

API base: `https://discord.com/api/v10`.

Code của Worker chỉ gọi Discord bằng interaction token. Vì vậy Worker KHÔNG ĐƯỢC giữ `DISCORD_BOT_TOKEN`, token này chỉ `scripts/register-discord.ts` cần.

**Verify.** Dùng `verifyKey` của `discord-interactions`, xem [security.md](security.md). KHÔNG ĐƯỢC dùng `verifyKeyMiddleware`, vì đó là middleware kiểu Express. Kiểm tra thất bại PHẢI trả 401. Discord cố ý gửi chữ ký sai, và sẽ gỡ endpoint URL nếu request đó được chấp nhận.

**Parse.**

| `type` của interaction | Kết quả |
| --- | --- |
| `1` PING | `respond` với `{"type":1}`, status 200, `Content-Type: application/json` |
| `2` APPLICATION_COMMAND có `channel_id` | `message` |
| Các loại khác | `ignore` |

| `IncomingMessage` | Nguồn |
| --- | --- |
| `chatId` | `channel_id` |
| `user.id` | `(member?.user ?? user).id` |
| `user.name` | `global_name` hoặc `username` của cùng user đó |
| `text` | `` `/${data.name}` `` |

Interaction trong guild để user ở `member.user`. Tin nhắn trực tiếp để user ở `user`.

**Acknowledge.** Trả `{"type":5}` (`DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`) với `Content-Type: application/json`. Response PHẢI đến trong vòng 3 giây kể từ khi có event.

**Reply.**

1. Gửi chunk đầu bằng `PATCH /webhooks/{app_id}/{token}/messages/@original`.
2. Gửi các chunk còn lại bằng `POST /webhooks/{app_id}/{token}`.

Token có hiệu lực 15 phút. Lần `PATCH` đầu PHẢI retry khi gặp 404, tối đa 3 lần với độ trễ ngắn, vì việc trong `waitUntil` có thể bắt đầu trước khi Discord nhận được acknowledgement.

**Giới hạn.**

- Worker chỉ nhận slash command. Không đọc được tin nhắn trong kênh.
- Phiên bản hiện tại chưa có option cho lệnh, nên `text` không bao giờ chứa tham số.

## Thêm nền tảng

Trước tiên, xác định nền tảng thuộc loại nào.

| Loại | Dấu hiệu | Cách làm |
| --- | --- | --- |
| Webhook | Gửi event qua HTTP và có cách xác minh request | Thêm adapter theo các bước bên dưới |
| Kết nối liên tục | Chỉ gửi event qua WebSocket | Worker không tự giữ được kết nối. Cần thiết kế riêng, ví dụ Durable Objects, và sửa [architecture.md](architecture.md) trước |
| Event không phải tin nhắn | Payload không ánh xạ được sang `IncomingMessage` | Không ép vào `IncomingMessage`. Sửa [contracts.md](contracts.md) trong một pull request riêng trước |

Các bước với nền tảng webhook:

1. Tạo `src/adapters/<name>/` với các file theo [architecture.md](architecture.md#cấu-trúc-thư-mục).
2. Chọn thư viện theo [conventions.md](conventions.md#thư-viện).
3. Thêm adapter vào `src/adapters/index.ts`. Route `/webhook/<name>` sẽ hoạt động mà không cần sửa routing.
4. Thêm secret của nền tảng vào `Env`, và thêm các bước cài đặt vào [operations.md](operations.md).
5. Thêm một mục vào tài liệu này với quy tắc verify, parse và reply.
6. Thêm test cho verify đúng, verify sai, từng kết quả parse, và reply thất bại.
7. Cập nhật bảng trạng thái trong [README.md](README.md).

Nền tảng mới KHÔNG ĐƯỢC đòi hỏi thay đổi trong `src/commands/`. Nếu có vẻ phải đổi, hãy sửa contract trong một pull request riêng trước.

### Ví dụ: Slack

Slack thuộc loại webhook, nên hợp với contract hiện tại:

| Contract | Slack |
| --- | --- |
| `verify` | HMAC-SHA256 của `v0:<timestamp>:<raw body>` so với `X-Slack-Signature`, và từ chối timestamp lệch quá 5 phút |
| `parse` trả `respond` | Bước `url_verification`, trả về giá trị `challenge` |
| `ack` | HTTP 2xx trong vòng 3 giây, nếu không Slack sẽ retry tối đa 3 lần |

Thư mục sẽ là `src/adapters/slack/`, và không có file nào ngoài adapter registry phải đổi code. Tài liệu Slack không nói rõ bước `url_verification` có được ký hay không, nên cần xác nhận khi implement.
