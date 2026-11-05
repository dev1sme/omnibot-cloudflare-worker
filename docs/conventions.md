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
- Giữ runtime dependency ở mức tối thiểu. Mỗi dependency làm tăng bundle và rủi ro supply chain, nên pull request thêm dependency PHẢI nêu lý do.

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

Stack là Vitest với `@cloudflare/vitest-pool-workers`, để test chạy trong Workers runtime.

Test KHÔNG ĐƯỢC gọi API thật của nền tảng. Hãy stub `fetch`.

| Thành phần | Test bắt buộc |
| --- | --- |
| Pipeline | Từng dòng trong bảng HTTP ở [contracts.md](contracts.md), và verify chạy trước parse |
| `verify` | Đúng, sai giá trị, thiếu header, sai định dạng |
| `parse` | Từng dòng trong bảng parse của adapter, cộng JSON sai định dạng |
| `reply` | Cấu trúc request, chia tin dài, throw khi nền tảng từ chối |
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
