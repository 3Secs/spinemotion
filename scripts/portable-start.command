#!/bin/bash
# SpineMotion — portable demo launcher (macOS).
# Serves the pre-built dist/ with Python's built-in HTTP server (no Node needed).

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

PORT="${PORT:-5173}"
URL="http://127.0.0.1:$PORT"

if curl -fsS -o /dev/null --max-time 2 "$URL" 2>/dev/null; then
  echo "SpineMotion 已在运行：$URL"
  open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" 2>/dev/null || true
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，请先安装 Python 3 后重试。"
  read -r -n 1 -s -p "按任意键关闭窗口…"
  exit 1
fi

echo ""
echo "SpineMotion — 本地人体运动实验室"
echo "本地地址：$URL"
echo "摄像头和模型都只在本机运行。按 Control+C 可停止。"
echo ""

if [ "${NO_OPEN:-0}" != "1" ]; then
  (
    sleep 2
    open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" 2>/dev/null || true
  ) &
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist
