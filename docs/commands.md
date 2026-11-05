# Lệnh

Lệnh là logic không phụ thuộc nền tảng: nhận một `IncomingMessage` và trả về một `OutgoingMessage`.

## Viết lệnh

Tạo `src/commands/hello.ts`:

```ts
import type { Command } from "../core/types";
import { messages } from "../messages";

export const hello: Command = {
  name: "hello",
  description: "Chào người dùng",
  async run(msg) {
    return { text: messages.hello(msg.user.name ?? messages.defaultUserName, msg.platform) };
  },
};
```

Đăng ký trong `src/commands/index.ts`:

```ts
import { hello } from "./hello";
export const commands = [ping, help, hello];
```

Với Discord, chạy `npm run register-discord` để slash command xuất hiện.

### Lệnh cần danh sách lệnh

Lệnh như `/help` đọc `deps.commands`. KHÔNG ĐƯỢC import `src/commands/index.ts` từ file lệnh, vì sẽ gây circular import.

```ts
export const help: Command = {
  name: "help",
  description: "Danh sách lệnh",
  async run(msg, { commands, env }) {
    const visible = commands.filter(
      (c) =>
        c.permission !== "admin" ||
        isAdmin(msg.platform, msg.user.id, env.ADMIN_USER_IDS),
    );
    return { text: visible.map((c) => `/${c.name}: ${c.description}`).join("\n") };
  },
};
```

## Quy tắc đặt tên

Các quy tắc này là phần con dùng được trên mọi nền tảng, lấy từ giới hạn của Discord.

- `name` PHẢI khớp `^[a-z0-9_-]{1,32}$`.
- `name` PHẢI là duy nhất.
- `description` PHẢI dài từ 1 đến 100 ký tự.

PHẢI có test kiểm tra mọi lệnh đã đăng ký theo các quy tắc này.

## Quy tắc routing

`resolve(text, commands)` trong `src/core/router.ts` hoạt động như sau.

| Đầu vào | Route |
| --- | --- |
| `hello` | `none`: không trả lời |
| `/hello` hoặc `/hello world` | `command` |
| `/HELLO` | `command`: tên lệnh không phân biệt hoa thường |
| `/missing` | `unknown`: trả lời kèm gợi ý dùng `/help` |

Router KHÔNG ĐƯỢC xử lý cú pháp riêng của nền tảng. Adapter chuẩn hoá phần đó khi parse, ví dụ `/ping@this_bot` của Telegram.

Việc trả lời `unknown` là có chủ đích. Nếu không, lệnh Discord cũ sẽ kẹt ở trạng thái loading. Cái giá là có thể thừa một tin trả lời trong group Telegram có nhiều bot.

## Tham số

Lệnh đọc tham số bằng cách parse `msg.text`. Phần text sau tên lệnh có trên Telegram và Zalo. Lệnh Discord chưa có option, nên lệnh PHẢI vẫn chạy được hoặc trả về hướng dẫn sử dụng khi không có tham số.

## Quy tắc runtime

- `run` chạy trong `ctx.waitUntil()`, sau khi đã acknowledge với nền tảng.
- Mọi việc trong `waitUntil` của một request dùng chung giới hạn 30 giây, promise còn chờ sau đó sẽ bị huỷ. Lời gọi ra ngoài PHẢI đặt timeout, chừa đủ thời gian để gửi reply:

  ```ts
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  ```

- Lệnh thất bại NÊN throw. Pipeline sẽ ghi log lỗi và gửi một câu trả lời chung chung.
- `run` KHÔNG ĐƯỢC trả về `text` chứa secret hoặc chi tiết lỗi của hệ thống nội bộ.
- `text` không dùng định dạng riêng của nền tảng.
- Lệnh có side effect PHẢI chịu được việc nhận trùng. Xem [contracts.md](contracts.md).

## Nội dung trả lời

Nội dung bot gửi cho người dùng PHẢI nằm trong `src/messages/`, không viết trực tiếp trong lệnh hoặc pipeline. Riêng `description` của lệnh viết trong file lệnh.

```ts
// src/messages/vi.ts
export const messages = {
  defaultUserName: "bạn",
  hello: (name: string, platform: string) => `Xin chào ${name} từ ${platform}!`,
  unknownCommand: "Không có lệnh này. Gõ /help để xem danh sách lệnh.",
  commandFailed: "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
  permissionDenied: "Bạn không có quyền dùng lệnh này.",
};

// src/messages/index.ts
export { messages } from "./vi";
```

Hiện chỉ có tiếng Việt, nên chưa dùng thư viện i18n. Khi cần thêm ngôn ngữ:

1. Thêm `src/messages/<locale>.ts` với cùng shape.
2. Lưu ngôn ngữ của người dùng trong KV, key `user:<platform>:<id>:lang`.
3. Chọn thư viện i18n theo [conventions.md](conventions.md#thư-viện) nếu cần số nhiều hoặc định dạng phức tạp.

## Phân quyền

Lệnh mặc định ai cũng dùng được. Lệnh có tác động lớn, như broadcast hoặc đổi cấu hình, PHẢI đặt `permission: "admin"`.

`ADMIN_USER_IDS` là danh sách `<platform>:<user_id>` phân tách bằng dấu phẩy:

```bash
ADMIN_USER_IDS="telegram:123456,discord:987654,zalo:6ede9afa66b88fe6d6a9"
```

- Pipeline kiểm tra quyền trước khi chạy lệnh. Lệnh không tự kiểm tra.
- PHẢI fail closed: thiếu `ADMIN_USER_IDS` thì không ai là admin.
- ID PHẢI có tên nền tảng, vì ID chỉ là duy nhất trong một nền tảng.
- Chỉ lấy `msg.user.id` từ payload đã qua `verify`. KHÔNG ĐƯỢC lấy danh tính từ nội dung tin nhắn.
- Quyền admin của group hay server trên nền tảng không được coi là quyền admin của omnibot.
- Slash command Discord vẫn hiện với mọi người, nên kiểm tra phía server là bắt buộc.

## Trạng thái

Dùng `deps.env.OMNIBOT_KV` cho dữ liệu đọc nhiều, ghi ít.

```ts
async run(msg, { env }) {
  const key = `user:${msg.platform}:${msg.user.id}:lang`;
  const lang = await env.OMNIBOT_KV.get(key);
  return { text: lang ? messages.language(lang) : messages.languageNotSet };
}
```

- Key PHẢI có `msg.platform`, vì ID chỉ là duy nhất trong một nền tảng.
- Key theo dạng `<entity>:<platform>:<id>[:<field>]`.
- KHÔNG ĐƯỢC dùng KV cho counter, lock, hoặc logic cần đọc ngay sau khi ghi. KV là eventually consistent và chỉ cho một lượt ghi mỗi giây trên một key.
