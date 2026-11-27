# TerManager-Platform — Windows và macOS

Một bộ mã Electron cho Windows và macOS, đặt trong thư mục độc lập `TerManager-Platform`. Thư mục `TerManager` bên cạnh vẫn chứa ứng dụng Swift/macOS cũ; bản này lưu dữ liệu riêng và chưa nhập cấu hình từ ứng dụng Swift.

## Chạy từ mã nguồn

Yêu cầu Node.js 24 trở lên và Windows 10/11 x64 hoặc macOS 13 trở lên. Mở terminal tại thư mục `TerManager-Platform`:

```sh
npm ci
npx --no install-electron
npm test
npm run test:smoke
npm run test:unicode
npm start
```

Windows dùng Windows PowerShell, PowerShell 7 hoặc CMD. PowerShell 7 cần được cài riêng và có `pwsh.exe` trong PATH. macOS dùng `/bin/zsh` hoặc `/bin/bash` ở chế độ login để nhận môi trường phát triển. Đổi shell áp dụng cho terminal mới hoặc khởi động lại; các phiên đang chạy được giữ nguyên.

`postinstall` sửa quyền thực thi của `spawn-helper` trong prebuild node-pty trên Mac. Bước này cần cho shell hoạt động sau khi cài dependencies và trong ứng dụng đóng gói. Không cần thêm dependency.

## Đóng gói

Build cho hệ điều hành/kiến trúc của máy hiện tại:

```sh
npm run dist
npm run test:package
```

Hoặc chọn nền tảng:

```sh
npm run dist:win
npm run dist:mac -- --arm64
npm run dist:mac -- --x64
```

Build macOS phải chạy trên Mac. Mac Apple Silicon dùng `arm64`, Mac Intel dùng `x64`; mỗi kiến trúc có gói riêng. Bộ cài Windows là x64. Người dùng bản đóng gói không cần cài Node.js.

Kết quả trong `dist/`:

- `TerManager-Platform-1.0.1-win-x64.exe`: bộ cài Windows cho tài khoản hiện tại.
- `TerManager-Platform-1.0.1-win-x64.zip`: giải nén toàn bộ rồi chạy `TerManager-Platform.exe`.
- `TerManager-Platform-1.0.1-mac-arm64.dmg` hoặc `mac-x64.dmg`: mở rồi kéo ứng dụng vào Applications.
- `TerManager-Platform-1.0.1-mac-arm64.zip` hoặc `mac-x64.zip`: chứa ứng dụng `.app`.

Khi kiểm tra gói khác hệ điều hành/kiến trúc của máy đang dùng, truyền đích tương ứng:

```sh
npm run test:package -- win32 x64
npm run test:package -- darwin arm64
npm run test:package -- darwin x64
```

Smoke test cũng có thể nạp mã và tài nguyên từ ASAR đã đóng gói, bằng runtime Electron phát triển cùng phiên bản:

```sh
npm run test:smoke -- dist/mac-arm64/TerManager-Platform.app/Contents/Resources/app.asar
```

`node-pty` 1.1 có sẵn binary N-API cho Windows x64 và Mac arm64/x64. Cấu hình tắt rebuild để giữ các prebuild này. Khi nâng dependency cần kiểm tra lại. Nếu npm phải biên dịch trên Windows, cần Python 3 và Visual Studio Build Tools với workload **Desktop development with C++**.

## GitHub Actions

Workflow `Desktop builds` trong `.github/workflows/desktop.yml` chạy riêng trên Windows và macOS. Mỗi job cài runtime, kiểm tra model, chạy smoke test PTY thật, đóng gói rồi kiểm tra executable và tài nguyên đi kèm. Job Mac dùng kiến trúc của runner macOS hiện tại.

Đưa thư mục `TerManager-Platform` lên repository GitHub riêng rồi mở **Actions → Desktop builds → Run workflow**. Tải artifact `TerManager-Platform-<OS>-<ARCH>` của job thành công. Workflow cũng chạy khi push hoặc mở PR; không tự phát hành release.

## Chức năng

- Thêm thư mục project; tạo, đổi tên và xóa task. Task dùng thư mục của project.
- Tối đa 9 terminal mỗi workspace, bố cục tự chia từ 1×1 đến 3×3.
- Đổi tên, ẩn/khôi phục, phóng to, khởi động lại và đóng terminal.
- Giữ phiên shell và nội dung khi chuyển project/task hoặc ẩn terminal.
- Lệnh agent `agy`, `codex`, `claude`, `gemini` và lệnh tùy chỉnh. CLI cần được cài riêng và có trong PATH.
- Bấm lệnh để mở terminal mới và chạy; kéo lệnh vào terminal để chèn rồi nhấn Enter. Task trùng tên lệnh sẽ mở terminal chạy lệnh đó.
- Bốn giao diện, cỡ chữ terminal 9–32.
- Windows: `Ctrl+T` thêm terminal, `Ctrl+\` ẩn/hiện sidebar, `Ctrl+,` mở thiết lập; `Ctrl+Shift+C/V` copy/paste terminal.
- Mac: dùng `Cmd+T`, `Cmd+\`, `Cmd+,` và `Cmd+C/V`. `Ctrl+C` vẫn ngắt lệnh trong terminal.

## Nhập tiếng Việt trên Mac

Từ bản 1.0.1, terminal trên Mac tự chọn locale UTF-8 nếu ứng dụng được mở với locale trống hoặc `C`/ASCII. Locale UTF-8 có sẵn được giữ lại. Điều này tránh lỗi xóa một phần byte của ký tự có dấu khi bộ gõ thay dấu hoặc khi bấm Backspace. Cần thoát rồi mở lại ứng dụng sau khi cập nhật để các shell nhận môi trường mới.

`npm run test:unicode` kiểm tra văn bản tiếng Việt qua Chromium → IPC → PTY → xterm, ghép dấu IME, dấu tổ hợp, xóa ký tự có dấu và giữ Backspace đến khi hết chữ (kiểm tra cả ô ký tự lẫn vị trí con trỏ). Trên Mac, kiểm tra cố tình khởi động Zsh với locale `C` và Bash không có locale để bắt lại lỗi này. Bộ kiểm tra cũng nạp được ASAR đóng gói như smoke test.

## Dữ liệu và giới hạn

Workspace được lưu vào `workspace.json` trong `app.getPath('userData')`. Trên Windows vẫn dùng `%APPDATA%\termanager-windows\workspace.json` để giữ cấu hình bản trước khi đổi tên. Trên Mac dùng thư mục dữ liệu của ứng dụng mới trong `~/Library/Application Support/`. Workspace Mac cũ lưu nhầm tên shell Windows sẽ được chuyển sang Zsh khi đọc, giữ bố cục và file gốc cho đến lần lưu tiếp theo.

Xóa project/task chỉ xóa cấu hình và dừng terminal liên quan, không xóa mã nguồn trên ổ đĩa. Workspace lỗi được giữ nguyên và ứng dụng báo vị trí file để khôi phục, không ghi đè bằng dữ liệu rỗng.

Khi thoát ứng dụng hoặc đóng cửa sổ cuối cùng, ứng dụng xác nhận trước khi dừng các terminal. Mở lại sẽ khôi phục bố cục và mở shell mới khi truy cập workspace; không khôi phục tiến trình/nội dung hoặc tự chạy lại lệnh agent.

Bản này chưa chuyển thanh chọn thiết bị/Run mobile, icon project tùy chỉnh, kéo ảnh/file vào terminal và kéo thay đổi chiều rộng từng cột từ bản Swift. Flutter/Android có thể dùng CLI với SDK cài riêng; build/chạy iOS vẫn cần Mac và Xcode. Đây là ứng dụng desktop, không phải ứng dụng iPhone/iPad.

Bộ cài Windows hiện chưa ký chứng chỉ; bản Mac chỉ ký ad-hoc, chưa ký bằng Developer ID hoặc notarize. SmartScreen hoặc Gatekeeper có thể chặn bản tải xuống. Chưa kiểm thử cài đặt trực tiếp trên Windows hoặc chạy trên Mac Intel; CI cần được chạy trên repository mới để xác nhận thêm.
