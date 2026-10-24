#!/bin/bash
# SpineMotion — one-click local launcher for macOS.
# Starts the Vite dev server and opens the exact local URL in Chrome.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

if [ -x "$ROOT/.tools/node/bin/node" ]; then
  export PATH="$ROOT/.tools/node/bin:$PATH"
elif ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "未找到 Node.js。"
  echo "请安装 Node.js LTS（>= 22.12）后重新双击本文件：https://nodejs.org/"
  echo ""
  read -r -n 1 -s -p "按任意键关闭窗口…"
  exit 1
fi

export npm_config_cache="$ROOT/.npm-cache"
export npm_config_update_notifier=false

URL="http://127.0.0.1:5173"

if curl -fsS -o /dev/null --max-time 2 "$URL" 2>/dev/null; then
  echo "SpineMotion 已在运行：$URL"
  open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" 2>/dev/null || true
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "首次运行：安装依赖…"
  npm install --no-audit --no-fund || {
    echo "依赖安装失败，请保留此窗口并联系开发人员。"
    read -r -n 1 -s -p "按任意键关闭窗口…"
    exit 1
  }
fi

if [ ! -f "public/models/pose_landmarker_lite.task" ]; then
  echo "缺少本地姿态模型：public/models/pose_landmarker_lite.task"
  echo "请重新获取项目资源后再启动。"
  read -r -n 1 -s -p "按任意键关闭窗口…"
  exit 1
fi

echo ""
echo "SpineMotion — 本地人体运动实验室"
echo "本地地址：$URL"
echo "摄像头和模型都只在本机运行。按 Control+C 可停止服务器。"
echo ""

if [ "${NO_OPEN:-0}" != "1" ]; then
  (
    sleep 2
    open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL" 2>/dev/null || true
  ) &
fi

exec npm run dev
