#!/bin/bash
# Double-click launcher for Style Advisor (macOS).
# Installs/builds on first run, checks Claude Code login, starts the local
# server, and opens the browser automatically. No terminal commands required.

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

LOG_FILE="$DIR/launcher.log"
PORT=4319
URL="http://localhost:$PORT"

say() { printf '%s\n' "$1"; }

fail() {
  say ""
  say "エラーが発生しました: $1"
  say "詳細なログは launcher.log を確認してください。"
  say ""
  read -r -p "何かキーを押すと終了します..." _
  exit 1
}

say "=== Style Advisor を起動しています ==="
say ""

# --- 1. Node.js の確認 -------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  say "Node.js が見つかりませんでした。インストールページを開きます。"
  say "インストール後、もう一度このファイルをダブルクリックしてください。"
  open "https://nodejs.org/"
  read -r -p "何かキーを押すと終了します..." _
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  say "Node.js のバージョンが古いようです（v20以上が必要です）。最新版のインストールページを開きます。"
  open "https://nodejs.org/"
  read -r -p "何かキーを押すと終了します..." _
  exit 1
fi
say "✓ Node.js を確認しました ($(node -v))"

# --- 2. 依存関係のインストール・ビルド（初回のみ） ----------------------
: > "$LOG_FILE"

if [ ! -d "node_modules" ]; then
  say "依存関係をインストールしています…（初回のみ、数分かかることがあります）"
  npm install >> "$LOG_FILE" 2>&1 || fail "MCPサーバーの依存関係インストールに失敗しました"
fi
if [ ! -d "dist" ]; then
  say "MCPサーバーをビルドしています…"
  npm run build >> "$LOG_FILE" 2>&1 || fail "MCPサーバーのビルドに失敗しました"
fi
if [ ! -d "web/node_modules" ]; then
  say "Web版の依存関係をインストールしています…（初回のみ、数分かかることがあります）"
  npm install --prefix web >> "$LOG_FILE" 2>&1 || fail "Web版の依存関係インストールに失敗しました"
fi
if [ ! -d "web/dist" ]; then
  say "Web版をビルドしています…"
  npm run build --prefix web >> "$LOG_FILE" 2>&1 || fail "Web版のビルドに失敗しました"
fi
say "✓ セットアップ完了"

# --- 3. Claude Code のログイン確認 -------------------------------------
CLAUDE_BIN="$(node web/scripts/claude-bin-path.mjs 2>>"$LOG_FILE")"
if [ -z "$CLAUDE_BIN" ]; then
  fail "Claude Code の実行ファイルが見つかりませんでした"
fi

STATUS_JSON="$("$CLAUDE_BIN" auth status 2>>"$LOG_FILE")"
if echo "$STATUS_JSON" | grep -q '"loggedIn": *true'; then
  say "✓ Claude にログイン済みです"
else
  say ""
  say "Claude にログインしていません。ブラウザでログインしてください。"
  say "（ログイン後、自動的に次に進みます）"
  "$CLAUDE_BIN" auth login || fail "Claude へのログインに失敗しました"
fi

# --- 4. サーバー起動 -----------------------------------------------------
say ""
say "サーバーを起動しています…"
node web/dist/server.js >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

# ポートが応答するまで待つ（最大30秒）
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$URL"; then
    break
  fi
  sleep 1
done

if ! curl -s -o /dev/null "$URL"; then
  fail "サーバーの起動に失敗しました"
fi

open "$URL"

say ""
say "=== 起動しました！ブラウザでご利用ください ==="
say "終了するときは、このウィンドウを閉じてください。"
say ""

wait "$SERVER_PID"
