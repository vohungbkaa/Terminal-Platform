#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RUN_TESTS=false
for arg in "$@"; do
  case "$arg" in
    --test) RUN_TESTS=true ;;
    -h|--help)
      echo "Sử dụng trong Git Bash trên Windows: ./build-win.sh [--test]"
      echo "  --test  Chạy unit/smoke/unicode test trước khi build"
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

echo "▶ Đang đóng gói TerManager-Platform cho Windows x64..."
npm run dist:win
npm run test:package -- win32 x64
echo "✔ Build và kiểm tra thành công. Bộ cài .exe và bản .zip nằm trong $SCRIPT_DIR/dist/"
