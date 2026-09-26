# Style Advisor launcher (Windows). Invoked by "Style Advisor を起動.bat".
# Installs/builds on first run, checks Claude Code login, starts the local
# server, and opens the browser automatically. No terminal commands required.
#
# NOTE: written and reviewed on macOS; not yet verified on a real Windows
# machine. Please report any errors so they can be fixed.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$LogFile = Join-Path $PSScriptRoot "launcher.log"
$Port = 4319
$Url = "http://localhost:$Port"

function Fail($message) {
    Write-Host ""
    Write-Host "エラーが発生しました: $message"
    Write-Host "詳細なログは launcher.log を確認してください。"
    Read-Host "何かキーを押すと終了します"
    exit 1
}

Write-Host "=== Style Advisor を起動しています ==="
Write-Host ""

# --- 1. Node.js の確認 ---------------------------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Node.js が見つかりませんでした。インストールページを開きます。"
    Write-Host "インストール後、もう一度このファイルをダブルクリックしてください。"
    Start-Process "https://nodejs.org/"
    Read-Host "何かキーを押すと終了します"
    exit 1
}

$nodeVersionOutput = (node -v).Trim()
$nodeMajor = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) {
    Write-Host "Node.js のバージョンが古いようです（v20以上が必要です）。最新版のインストールページを開きます。"
    Start-Process "https://nodejs.org/"
    Read-Host "何かキーを押すと終了します"
    exit 1
}
Write-Host "OK: Node.js を確認しました ($(node -v))"

# --- 2. 依存関係のインストール・ビルド（初回のみ） ------------------------
"" | Out-File -FilePath $LogFile -Encoding utf8

if (-not (Test-Path "node_modules")) {
    Write-Host "依存関係をインストールしています…（初回のみ、数分かかることがあります）"
    cmd /c "npm install >> `"$LogFile`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "MCPサーバーの依存関係インストールに失敗しました" }
}
if (-not (Test-Path "dist")) {
    Write-Host "MCPサーバーをビルドしています…"
    cmd /c "npm run build >> `"$LogFile`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "MCPサーバーのビルドに失敗しました" }
}
if (-not (Test-Path "web/node_modules")) {
    Write-Host "Web版の依存関係をインストールしています…（初回のみ、数分かかることがあります）"
    cmd /c "npm install --prefix web >> `"$LogFile`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "Web版の依存関係インストールに失敗しました" }
}
if (-not (Test-Path "web/dist")) {
    Write-Host "Web版をビルドしています…"
    cmd /c "npm run build --prefix web >> `"$LogFile`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Fail "Web版のビルドに失敗しました" }
}
Write-Host "OK: セットアップ完了"

# --- 3. Claude Code のログイン確認 ----------------------------------------
$claudeBin = (node web/scripts/claude-bin-path.mjs 2>>$LogFile) | Select-Object -Last 1
if (-not $claudeBin) { Fail "Claude Code の実行ファイルが見つかりませんでした" }

$statusJson = & $claudeBin auth status 2>>$LogFile
$loggedIn = $false
try {
    $status = $statusJson | ConvertFrom-Json
    $loggedIn = $status.loggedIn -eq $true
} catch {
    $loggedIn = $false
}

if ($loggedIn) {
    Write-Host "OK: Claude にログイン済みです"
} else {
    Write-Host ""
    Write-Host "Claude にログインしていません。ブラウザでログインしてください。"
    Write-Host "（ログイン後、自動的に次に進みます）"
    & $claudeBin auth login
    if ($LASTEXITCODE -ne 0) { Fail "Claude へのログインに失敗しました" }
}

# --- 4. サーバー起動 ------------------------------------------------------
Write-Host ""
Write-Host "サーバーを起動しています…"
$serverProcess = Start-Process -FilePath "node" -ArgumentList "web/dist/server.js" `
    -WorkingDirectory $PSScriptRoot `
    -RedirectStandardOutput $LogFile -RedirectStandardError "$LogFile.err" -PassThru -NoNewWindow

try {
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { Fail "サーバーの起動に失敗しました" }

    Start-Process $Url

    Write-Host ""
    Write-Host "=== 起動しました！ブラウザでご利用ください ==="
    Write-Host "終了するときは、このウィンドウを閉じてください。"
    Write-Host ""
    Wait-Process -Id $serverProcess.Id
} finally {
    if (-not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
