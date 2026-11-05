# Quy ước

## Ngôn ngữ

Tài liệu trong `docs/`, `CLAUDE.md` và `README.md` viết bằng tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh.

Code, comment, identifier và commit message PHẢI viết bằng tiếng Anh. Câu trả lời của bot CÓ THỂ dùng tiếng Việt.

## TypeScript

- Bật `strict` trong `tsconfig.json`.
- KHÔNG ĐƯỢC dùng `any`. Dùng `unknown` cho dữ liệu từ bên ngoài, rồi thu hẹp type trong adapter.
- Dùng `import type` cho import chỉ có type.
- Dùng named export. Default export duy nhất là Worker handler trong `src/index.ts`, do runtime yêu cầu.
- Dùng Web API (`fetch`, `crypto.subtle`, `Response`). Không thêm API chỉ có trên Node.js vào code của Worker.

## Thư viện

NÊN dùng thư viện thay vì tự viết, nếu có thư viện đạt các điều kiện dưới đây. KHÔNG ĐƯỢC tự viết crypto.

### Điều kiện chọn

Thư viện PHẢI:

- Chạy được trong Workers runtime, được xác nhận bằng test chạy trong runtime đó.
- Còn được bảo trì, và có license tương thích với MIT.
- Có TypeScript types.
- Không làm vượt giới hạn CPU và startup trong [operations.md](operations.md#giới-hạn-free-tier).

Thư viện KHÔNG ĐƯỢC chiếm luồng xử lý request trong [architecture.md](architecture.md#vòng-đời-request). Với SDK kiểu framework, chỉ dùng phần API client hoặc helper.

### Khi nào được tự viết

Chỉ tự viết khi thoả một trong hai điều kiện, và PHẢI nêu lý do trong pull request:

- Không có thư viện nào đạt điều kiện.
- Phần code nhỏ đến mức thư viện không đáng so với chi phí bundle và rủi ro supply chain, ví dụ `parseJson`, `splitMessage`.

### Thư viện đã chọn

| Việc | Thư viện | Ghi chú |
| --- | --- | --- |
| Routing | `hono` | |
| Validate payload | `valibot` | Nhẹ hơn Zod, phù hợp giới hạn CPU và startup |
| Gọi API Telegram | `grammy` | Chỉ dùng class `Api` |
| Chữ ký Discord | `discord-interactions` | Chỉ dùng `verifyKey` |
| Type của Discord | `discord-api-types` | Chỉ dùng type |

Muốn đổi hoặc thêm thư viện vào bảng này thì sửa tài liệu trong cùng pull request.

## Đặt tên

| Đối tượng | Kiểu | Ví dụ |
| --- | --- | --- |
| File | `kebab-case.ts` | `split-message.ts` |
| Function, biến | `camelCase` | `splitMessage` |
| Type, interface | `PascalCase` | `IncomingMessage` |
| Hằng số cấp module | `UPPER_SNAKE_CASE` | `MAX_TEXT_LENGTH` |
| Biến môi trường | `UPPER_SNAKE_CASE` | `TELEGRAM_BOT_TOKEN` |
| Object lệnh | Tên lệnh | `export const hello` |
| Object adapter | Tên nền tảng | `export const telegram` |

## Hằng số

Giới hạn của nền tảng và API base URL PHẢI là hằng số có tên, đặt trong adapter sử dụng chúng.

```ts
const MAX_TEXT_LENGTH = 4096;
```

## Lỗi

- `verify` và `parse` trả về giá trị khi thất bại, không throw.
- `reply` và lệnh throw khi thất bại. Pipeline bắt và ghi log lỗi.
- Không nuốt lỗi mà không ghi log. Logging tuân theo [security.md](security.md).

## Test

Stack là Vitest với `@cloudflare/vitest-pool-workers`, để test chạy trong Workers runtime. File test đặt cạnh code, ví dụ `src/core/router.test.ts`.

Test KHÔNG ĐƯỢC gọi API thật của nền tảng. Hãy stub `fetch`.

| Thành phần | Test bắt buộc |
| --- | --- |
| Pipeline | Từng dòng trong bảng HTTP ở [contracts.md](contracts.md), và verify chạy trước parse |
| `verify` | Đúng, sai giá trị, thiếu header, sai định dạng |
| `parse` | Từng dòng trong bảng parse của adapter, cộng JSON sai định dạng |
| `reply` | Cấu trúc request, chia tin dài, throw khi nền tảng từ chối |
| Response | `ok()` và `fail()` đúng shape, status và `message` cố định theo `code` |
| Router | Từng dòng trong bảng routing ở [commands.md](commands.md) |
| `splitMessage` | Đúng giới hạn, vượt giới hạn một đơn vị, không tách surrogate pair, không có chunk rỗng |
| Danh sách lệnh | Quy tắc tên và mô tả, tên không trùng |
| Từng lệnh | Câu trả lời, và từng nhánh thất bại |

Test chữ ký Discord PHẢI dùng cặp khoá Ed25519 thật được tạo trong test.

## Commit

Theo Conventional Commits:

```
<type>(<scope>): <subject>
```

- Type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope: `router`, `pipeline`, `zalo`, `telegram`, `discord`, `commands`, `scripts`, hoặc tên lệnh.
- Subject ở dạng mệnh lệnh, viết thường, không có dấu chấm cuối. Header tối đa 72 ký tự.
- Mỗi commit là một thay đổi logic.

```
feat(telegram): strip bot mention from commands
fix(discord): retry first reply edit on 404
```

## Branch và pull request

- KHÔNG ĐƯỢC commit thẳng vào `main`. Hãy dùng pull request.
- Tên branch theo dạng `<type>/<mô-tả-ngắn>`, ví dụ `feat/telegram-adapter`.
- Chạy `npm run lint && npm test` trước khi mở pull request.

## Definition of Done

Một thay đổi hoàn thành khi thoả tất cả điều kiện sau:

- [ ] `npm run lint` và `npm test` đều pass.
- [ ] Test bao phủ hành vi mới và các nhánh thất bại của nó.
- [ ] Các quy tắc phụ thuộc trong [architecture.md](architecture.md) vẫn đúng.
- [ ] Log không chứa secret, token, hay nội dung tin nhắn.
- [ ] Tài liệu khớp với code, kể cả bảng trạng thái trong [README.md](README.md).
- [ ] Secret mới đã có trong `Env` và [operations.md](operations.md).
- [ ] Lệnh mới hoặc đã đổi đã được đăng ký bằng `npm run register-discord`, nếu đã deploy.
- [ ] Thay đổi đã được test qua tunnel hoặc bản deploy trên từng nền tảng bị ảnh hưởng. Nếu không làm được, hãy ghi chú trong pull request.
