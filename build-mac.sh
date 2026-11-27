#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="TerManager-Platform.app"
DEST_APP="/Applications/$APP_NAME"
RUN_TESTS=false
INSTALL_APP=true
OPEN_APP=true

for arg in "$@"; do
  case "$arg" in
    --test) RUN_TESTS=true ;;
    --no-install) INSTALL_APP=false; OPEN_APP=false ;;
    --no-open) OPEN_APP=false ;;
    -h|--help)
      echo "Sử dụng: ./build-mac.sh [--test] [--no-install] [--no-open]"
      echo "  --test        Chạy unit/smoke/unicode test trước khi build"
      echo "  --no-install  Chỉ build vào dist/, không cài vào /Applications"
      echo "  --no-open     Cài vào /Applications nhưng không tự mở app"
      exit 0
      ;;
    *)
      echo "Tham số không hợp lệ: $arg" >&2
      exit 1
      ;;
  esac
done

if [ "$RUN_TESTS" = true ]; then
  echo "▶ Đang chạy kiểm thử..."
  npm test
  npm run test:smoke
  npm run test:unicode
fi

echo "▶ Đang build $APP_NAME cho macOS..."
npm run dist:mac

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ] && [ -d "$SCRIPT_DIR/dist/mac-arm64/$APP_NAME" ]; then
  BUILT_APP="$SCRIPT_DIR/dist/mac-arm64/$APP_NAME"
elif [ -d "$SCRIPT_DIR/dist/mac/$APP_NAME" ]; then
  BUILT_APP="$SCRIPT_DIR/dist/mac/$APP_NAME"
else
  echo "✖ Không tìm thấy $APP_NAME trong thư mục dist/" >&2
  exit 1
fi

echo "✔ Build thành công: $BUILT_APP"

if [ "$INSTALL_APP" = true ]; then
  echo "▶ Đang đóng phiên bản cũ (nếu đang chạy)..."
  osascript -e 'tell application "TerManager-Platform" to quit' 2>/dev/null || true
  sleep 1
  pkill -f "$DEST_APP" 2>/dev/null || true

  echo "▶ Đang cài đặt vào $DEST_APP..."
  rm -rf "$DEST_APP"
  ditto "$BUILT_APP" "$DEST_APP"
  xattr -cr "$DEST_APP" 2>/dev/null || true
  echo "✔ Đã cài đặt xong: $DEST_APP"

  if [ "$OPEN_APP" = true ]; then
    echo "▶ Đang khởi chạy TerManager-Platform..."
    open -a "$DEST_APP"
  fi
fi
