# Style Advisor MCP

自己申告の身体的特徴（骨格・パーソナルカラーなど）をもとに、AI（Claude）が理由付きで
コーディネートを提案するアプリです。診断・提案の判断はAI自身が行います。

同じ仕組みで別テーマのAIチャットツールを作る手順は [docs/MANUAL.md](docs/MANUAL.md) を参照してください。

## 使い方（一番かんたんな方法）

1. このフォルダをまるごと自分のPCにコピーする
2. 以下のファイルをダブルクリックする
   - **Mac**: `Style Advisor を起動.command`
   - **Windows**: `Style Advisor を起動.bat`
3. 初回だけ、少し待つ（自動で必要なものをインストール・ビルドします）
4. Claude にログインしていない場合はブラウザが開くので、ログインする
5. 自動でブラウザが開いたら、そこにメッセージを入力する

**注意**：初回起動時、OSのセキュリティ機能により「開発元が未確認のため開けません」といった
警告が出ることがあります（コード署名未対応のため）。
- **Mac**: ファイルを Control キーを押しながらクリック →「開く」を選択
- **Windows**: 「詳細情報」→「実行」を選択

動作には Claude へのログイン（または `ANTHROPIC_API_KEY`）が必要です。

## 提供している機能

**Resources（AIが診断・提案の参考にする知識データ）**
- `style://guides/frame/{straight|wave|natural}` — 骨格タイプ別ガイド
- `style://palettes/{spring|summer|autumn|winter}` — パーソナルカラー別パレット
- `style://occasions/{business|casual|date|interview|ceremony}` — シーン別ドレスコード

**Tools（ローカルファイルの読み書き）**
- `get_profile_notes` / `save_profile_notes` — 会話で分かった情報（骨格タイプ・好み・よく使う場面など）を
  リポジトリルートの `profile.md` に保存・再利用する。中身は本人のPC内にしか残らない
  （`.gitignore` 済み、外部送信なし）。

実在する購入可能な商品の紹介は、WebSearch/WebFetch で実際に検索した結果にのみ基づきます。

## セットアップ（エンジニア向け）

```bash
npm install
npm run build
```

```bash
npm run dev     # tsx で直接起動
npm test        # vitest
npm run lint    # eslint
npm run inspector  # MCP Inspector で動作確認
```

## Claude Desktop / Claude Code への接続

```json
{
  "mcpServers": {
    "style-advisor": {
      "command": "node",
      "args": ["/absolute/path/to/style-advisor-mcp/dist/index.js"]
    }
  }
}
```

## Web版（ローカルチャットUI）

`web/` にローカル専用のWebアプリがあります。バックエンド（Claude Agent SDK）が自分のPC上の
Claude を呼び出し、このMCPサーバーをツールとして使いながら応答します。

```bash
npm run build          # このMCPサーバーをビルド（web側から参照される）
npm run web:install    # web/ の依存関係をインストール（初回のみ）
npm run web            # web/ をビルドして起動
```

起動後、ブラウザで `http://localhost:4319` を開いてください。
