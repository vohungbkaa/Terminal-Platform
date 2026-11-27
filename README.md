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

## Build và cài đặt nhanh trên macOS

Dự án đã có script tự động [build-mac.sh](build-mac.sh) giúp build, đóng app cũ và cài đặt đè trực tiếp vào `/Applications/TerManager-Platform.app`:

```sh
# Build nhanh, cài đặt vào /Applications và tự động mở app (chỉ mất ~10 giây)
./build-mac.sh

# Chạy toàn bộ test (unit, smoke, unicode) trước khi build & cài đặt
./build-mac.sh --test

# Đóng gói đầy đủ cả file .dmg và .zip cho phân phối (nằm trong thư mục dist/)
./build-mac.sh --dist

# Chỉ build ra thư mục dist/, không ghi đè vào /Applications
./build-mac.sh --no-install

# Cài đặt vào /Applications nhưng không tự mở ứng dụng
./build-mac.sh --no-open
```

## Đóng gói thủ công

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

## Chức năng & Giao diện

Giao diện được đồng bộ hoàn toàn với phong cách macOS Native / Glass & Graphite của dự án `TerManager`:

- **Thanh tiêu đề & Cửa sổ macOS**: Titlebar ẩn viền (`hiddenInset`), căn lề chuẩn nút đèn giao thông (traffic lights) của macOS, giữ nguyên viền tiêu đề chuẩn trên Windows.
- **Thanh bên (Sidebar) kiểu Arc / Linear**:
  - Kéo thanh chia để thay đổi chiều rộng sidebar đến sát mép cửa sổ, không giới hạn cố định 340px.
  - Nút thư mục có dấu **+** tạo thư mục thật trên ổ đĩa: nhập tên, chọn nơi lưu; thư mục mới được thêm thành project. Nút **+** bên cạnh vẫn thêm thư mục đã có.
  - Tự động hiển thị ô lọc nhanh khi có từ 4 dự án trở lên.
  - Cây danh mục dự án & task có hướng dẫn đường kẻ dọc (tree-guide), icon phân loại SVG trực quan (`sparkles` cho AI tasks, `terminal` cho terminal tasks), đếm số lượng terminal đang chạy, thao tác sửa/xóa/thêm hiện mượt mà khi hover.
  - Thanh footer gắn bộ 5 chấm chọn giao diện nhanh (Theme Swatches) cùng nút mở Thiết lập.
- **Không gian khởi chạy (Developer Launchpad)**: Khi một workspace chưa có terminal nào, hiển thị màn hình Launchpad với hiệu ứng radial glow, các thẻ thao tác nhanh (**Mở Terminal**, **Chia đôi màn hình**), các nút AI CLI (`agy`, `codex`, `claude`, `gemini`), và hỗ trợ kéo thả lệnh hoặc thư mục trực tiếp vào.
- **Lưới Terminal & Phóng to (Zoom / Focus Mode)**:
  - Tối đa 9 terminal mỗi workspace, bố cục tự chia từ 1×1 đến 3×3.
  - Header pane siêu mảnh 28px với đèn trạng thái phiên shell, nút thu phóng (Zoom), ẩn xuống thanh trạng thái, khởi động lại và đóng.
  - Khi phóng to 1 pane, terminal pane chiếm toàn bộ khung nhìn mà không ngắt tiến trình ngầm của các pane còn lại; thanh topbar hiện nút thuốc nhộng **Thoát phóng to** để quay lại lưới.
- **Thanh trạng thái dưới đáy (Status Bar 26px)**:
  - Hiển thị đường dẫn thư mục hiện tại với nút 1-click sao chép đường dẫn (kèm phản hồi icon checkmark).
  - Khay Dock các terminal đang ẩn chạy ngầm (Hidden Panes) dạng capsule giúp khôi phục nhanh mà không làm nhảy bố cục.
  - Hiển thị badge tỉ lệ lưới hiện tại (`1×1`, `1×2`, `2×2`...) và nhãn shell đang dùng.
- **Bảng lệnh Agent (Drawer kính mờ)**: Bảng lệnh trượt nổi bên phải, hỗ trợ kéo thả lệnh vào bất kỳ terminal nào hoặc bấm để mở ngay terminal mới. Tự mở khi mở shell trống (terminal mới, khôi phục hoặc khởi động lại) và tự thu lại sau khi gửi lệnh từ bảng hoặc khi agent trong terminal đó bắt đầu chạy.
- **Model trên toolbar terminal**: Theo dõi trạng thái đang hiển thị của agy, Codex, Claude và Gemini theo từng tiến trình. agy lấy danh sách từ `agy models`; Codex đọc danh sách và các mức reasoning trong cache của CLI (`CODEX_HOME/models_cache.json`, mặc định `~/.codex/models_cache.json`). Chọn model và mức rồi bấm **Áp dụng** mới gửi lệnh. Claude/Gemini và Codex chưa có cache dùng menu `/model` gốc để giữ đúng các lựa chọn của agent. Mở lại ứng dụng để làm mới danh sách đã tải.
- **Bảng Thiết Lập (Settings Slide-over)**: Dạng panel kính mờ trượt từ cạnh phải, gồm bộ thẻ preview trực quan cho 5 theme màu, xem trước màu terminal, thanh trượt cỡ chữ, độ đục cửa sổ từ 40–100% và chọn shell mặc định. Độ đục áp dụng cho cả nền lẫn chữ; Hủy hoặc Esc khôi phục cấu hình đã lưu.
- **Hệ thống 5 Theme màu sắc**: Graphite, Obsidian, Warm Dusk, Nord Frost và Hacker. Hacker dùng nền đen, chữ xanh phosphor, viền xanh và bảng màu 16-ANSI riêng. Theme và độ đục đã lưu được khôi phục khi mở lại ứng dụng.
- **Phím tắt chuẩn Desktop**:
  - Windows: `Ctrl+T` thêm terminal, `Ctrl+\` ẩn/hiện sidebar, `Ctrl+,` mở thiết lập; `Ctrl+Shift+C/V` copy/paste terminal.
  - Mac: `Cmd+T`, `Cmd+\`, `Cmd+,` và `Cmd+C/V`. `Ctrl+C` vẫn ngắt lệnh (SIGINT) chuẩn trong shell.

## Nhập tiếng Việt trên Mac

Terminal dùng Fira Code 6.2 đi kèm ứng dụng, chữ thường medium 500 và chữ đậm 700. Font được nạp trước khi đo lưới ký tự; không cần cài font riêng. Giấy phép SIL Open Font License nằm trong `fonts/OFL.txt`.

Từ bản 1.0.1, terminal trên Mac tự chọn locale UTF-8 nếu ứng dụng được mở với locale trống hoặc `C`/ASCII. Locale UTF-8 có sẵn được giữ lại. Điều này tránh lỗi xóa một phần byte của ký tự có dấu khi bộ gõ thay dấu hoặc khi bấm Backspace. Cần thoát rồi mở lại ứng dụng sau khi cập nhật để các shell nhận môi trường mới.

`npm run test:unicode` kiểm tra văn bản tiếng Việt qua Chromium → IPC → PTY → xterm, ghép dấu IME, dấu tổ hợp, xóa ký tự có dấu và giữ Backspace đến khi hết chữ (kiểm tra cả ô ký tự lẫn vị trí con trỏ). Trên Mac, kiểm tra cố tình khởi động Zsh với locale `C` và Bash không có locale để bắt lại lỗi này. Bộ kiểm tra cũng nạp được ASAR đóng gói như smoke test.

## Dữ liệu và giới hạn

Workspace được lưu vào `workspace.json` trong `app.getPath('userData')`. Trên Windows vẫn dùng `%APPDATA%\termanager-windows\workspace.json` để giữ cấu hình bản trước khi đổi tên. Trên Mac dùng thư mục dữ liệu của ứng dụng mới trong `~/Library/Application Support/`. Workspace Mac cũ lưu nhầm tên shell Windows sẽ được chuyển sang Zsh khi đọc, giữ bố cục và file gốc cho đến lần lưu tiếp theo.

Xóa project/task chỉ xóa cấu hình và dừng terminal liên quan, không xóa mã nguồn trên ổ đĩa. Workspace lỗi được giữ nguyên và ứng dụng báo vị trí file để khôi phục, không ghi đè bằng dữ liệu rỗng.

Khi thoát ứng dụng hoặc đóng cửa sổ cuối cùng, ứng dụng xác nhận trước khi dừng các terminal. Mở lại sẽ khôi phục bố cục và mở shell mới khi truy cập workspace; không khôi phục tiến trình/nội dung hoặc tự chạy lại lệnh agent.

Tên model trên toolbar phụ thuộc vào trạng thái mà CLI hiển thị. Footer bị ẩn, bị cắt do terminal quá hẹp hoặc đổi định dạng có thể khiến ứng dụng chưa xác định được model; khi đó dùng menu `/model` của agent để kiểm tra.

Bản này chưa chuyển thanh chọn thiết bị/Run mobile, icon project tùy chỉnh, kéo ảnh/file vào terminal và kéo thay đổi chiều rộng từng cột từ bản Swift. Flutter/Android có thể dùng CLI với SDK cài riêng; build/chạy iOS vẫn cần Mac và Xcode. Đây là ứng dụng desktop, không phải ứng dụng iPhone/iPad.

Bộ cài Windows hiện chưa ký chứng chỉ; bản Mac chỉ ký ad-hoc, chưa ký bằng Developer ID hoặc notarize. SmartScreen hoặc Gatekeeper có thể chặn bản tải xuống. Chưa kiểm thử cài đặt trực tiếp trên Windows hoặc chạy trên Mac Intel; CI cần được chạy trên repository mới để xác nhận thêm.
