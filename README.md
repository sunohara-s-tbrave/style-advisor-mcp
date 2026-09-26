# Style Advisor MCP

自己申告の身体的特徴（骨格・パーソナルカラーなど）をもとに、AI（Claude）が理由付きで
コーディネートを提案するアプリです。**診断・提案の判断はAI自身が行います**（MCPサーバーは
AIが参照する知識データや、ローカルファイルの読み書きといった「道具」だけを提供します）。
背景は [CLAUDE.md](CLAUDE.md) の「方針転換」を参照してください。設計時の初期案は
[DESIGN.md](DESIGN.md) にありますが、§1.2 の「LLMを呼ばない」という方針は撤回済みです。

## 現在の状態

MCPサーバーは、以下を提供しています。

**Resources（AIが診断・提案の参考にする知識データ）**
- `style://guides/frame/{straight|wave|natural}` — 骨格タイプ別ガイド
- `style://palettes/{spring|summer|autumn|winter}` — パーソナルカラー別パレット
- `style://occasions/{business|casual|date|interview|ceremony}` — シーン別ドレスコード

**Tools（ローカルファイルの読み書き）**
- `get_profile_notes` / `save_profile_notes` — 会話で分かった情報（骨格タイプ・好み・性格・よく使う場面など）を
  リポジトリルートの `profile.md` に保存・再利用する。ユーザー本人だけでなく、相談対象になった
  周りの人（子供・パートナー・友人など）についても、人ごとに見出しを分けて記録する。中身はAIが
  自由に構成するMarkdownで、内容は本人のPC内にしか残らない（`.gitignore` 済み、外部送信なし）。

実際の診断・コーディネート提案・商品検索は [Web版](#web版ローカルで自分の-claude-code-を呼び出すui)
から Claude を通じて行います。商品紹介は「抽象（色・形・素材感などの傾向）」と「具体（実在する
購入可能な商品）」で役割を分けており、具体の商品は Claude Code 組み込みの WebSearch/WebFetch で
実際に検索した結果にのみ基づきます。会話は一度に大量の提案をせず、少しずつ相手の要望を汲み取る
ペースで進めるようシステムプロンプトで指示しています。

## 使い方（非エンジニア向け・一番かんたんな方法）

1. このフォルダをまるごと自分のPCにコピーする
2. 以下のファイルをダブルクリックする
   - **Mac**: `Style Advisor を起動.command`
   - **Windows**: `Style Advisor を起動.bat`
3. 初回だけ、少し待つ（自動で必要なものをインストール・ビルドします）
4. Claude にログインしていない場合はブラウザが開くので、ログインする
5. 自動でブラウザが開いたら、そこにメッセージを入力する

**唯一の注意点**：初回起動時、OSのセキュリティ機能により「開発元が未確認のため開けません」といった
警告が出ることがあります。
- **Mac**: ファイルを Control キーを押しながらクリック →「開く」を選択
- **Windows**: 「詳細情報」→「実行」を選択

これは、まだ有料の開発者証明書で署名していないために出る一般的な警告です（詳しくは
[CLAUDE.md](CLAUDE.md) の「今後の課題」を参照）。ターミナルの操作は一切不要です。

## セットアップ（エンジニア向け・手動で動かす場合）

```bash
npm install
npm run build
```

## 動作確認（MCP Inspector）

```bash
npm run inspector
```

ブラウザが開くので、Resources タブから `style://guides/frame/straight` などを読み込み、
内容が返ることを確認してください。

## Claude Desktop / Claude Code への接続

`claude_desktop_config.json`（または Claude Code の MCP 設定）に以下を追加します。

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

## 開発

```bash
npm run dev     # tsx で直接起動
npm test        # vitest
npm run lint    # eslint
```

開発ルールは [CLAUDE.md](CLAUDE.md) を参照してください。

## Web版（ローカルで自分の Claude Code を呼び出すUI）

`web/` にローカル専用の Web アプリを用意しています。ブラウザからメッセージを送ると、
バックエンド（[Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)）が
**自分のPCの Claude Code** をその場で起動し、この MCP サーバーをツールとして呼び出した結果を
画面に表示します。ローカル完結・単一ユーザー利用が前提のため、消費されるトークンは常に
実行した本人のもの（Claude Code のログイン、または `ANTHROPIC_API_KEY`）です。

Web版のシステムプロンプト（`web/src/server.ts`）が、AIに骨格診断・パーソナルカラー診断・
コーディネート提案を担わせつつ、上記の Resources を参考資料として案内し、実在商品は
WebSearch/WebFetch で検索させる指示になっています。

```bash
npm run build         # このMCPサーバーをビルド（web側から参照される）
npm run web:install    # web/ の依存関係をインストール（初回のみ）
npm run web            # web/ をビルドして起動
```

起動後、ブラウザで `http://localhost:4319` を開いてください。事前に Claude Code へのログイン
（または `ANTHROPIC_API_KEY` の設定）が必要です。

配布して各自のPCで動かす場合、各自の環境に Node.js と Claude Code（または API キー）が
セットアップ済みであることが前提です。ワンクリックで起動できるインストーラー化は今後の課題です。
