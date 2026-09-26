# CLAUDE.md — style-advisor-mcp 開発ルール

設計の背景は [DESIGN.md](DESIGN.md) を参照。**ただし §1.2「MCPサーバー側でLLMを呼ばない」という方針は撤回済み**（下記「方針転換」参照）。ここには現時点で実装時に必ず守るルールだけをまとめる。

## 方針転換（2026年9月）

DESIGN.md §1.2 は「診断・提案ロジックはMCPサーバー側の決定論的なコードが担い、AIは対話の窓口に徹する」という設計だった。これを撤回し、**骨格診断・パーソナルカラー診断・コーディネート提案は、すべてAI（Claude）自身の判断で行う**方針に転換した。理由や経緯は Web版バックエンド（`web/src/server.ts`）のシステムプロンプトを参照。

この転換に伴い、DESIGN.md にあった `engine/`（frameDiagnosis / colorDiagnosis / scoring / outfitBuilder）と `get_questionnaire` / `diagnose_body_frame` / `diagnose_personal_color` / `recommend_outfits` / `evaluate_item` の5ツールは**作らない**。代わりに、MCPサーバーは以下の役割に絞る。

1. **Resources（参考資料）** — AIが診断・提案の判断材料にする知識データ。`style://guides/frame/{type}`、`style://palettes/{season}`、`style://occasions/{occasion}`。ロジックではなく、AIが読み込んで参照するための静的な知識。
2. **プロフィールメモの読み書き（Tools）** — `get_profile_notes` / `save_profile_notes`。ユーザーについて分かったことをローカルの `profile.md` に保存する（詳細は下記「ローカル保存について」）。ここも診断ロジックは持たず、AIが書いた全文をそのまま読み書きするだけ。
3. **将来的な商品検索の接続点**（未実装） — 「実際に販売している商品」を紹介する際は、AIの知識だけに頼らせず実在データに接地させる。現状は Claude Code 組み込みの `WebSearch`/`WebFetch` を使っており、MCPツールとしての商品検索は未実装。

### ローカル保存について（2026年9月〜）

当初「サーバーは個人情報を保存しない」という方針だったが、ユーザーからの明示的な要望により撤回。
骨格タイプ・パーソナルカラー・好みなど、会話で分かった内容は `profile.md`（リポジトリルート、`.gitignore` 済み）
にAI自身の判断で保存される。あくまで**ローカルファイルのみ**（外部送信・DB保存はしない）。

## 絶対ルール

1. **`console.log` 禁止（`src/` 配下）。ログは必ず `console.error`。**
   stdio トランスポートでは標準出力が JSON-RPC 通信そのものなので、標準出力を汚すとクライアントが壊れる（`web/` 側はこの制約を受けないが、ログ規律として踏襲している）。
2. **ユーザー情報の保存はローカルの `profile.md` のみに限る。** DBや外部送信は行わない。ログにも出さない（`profile.md` の中身自体をコンソールに書き出さない）。
3. **提案には理由を添える（AIの応答として）。** 説明可能性は評価上の最重要ポイント。
4. **ポジティブ表現を徹底する。** 「隠す」「ごまかす」「太って見える」等のネガティブ語を `data/*.json` の知識データ、および Web版のシステムプロンプトの指示に使わない。
5. **体重・BMI・年齢は入力に含めない。**
6. **「抽象」と「具体」の商品提案を混同しない。**
   - 抽象（色・形・シルエット・サイズ感・素材感の傾向）＝ AI自身の判断。Resourcesを参考にしてよい。
   - 具体（実在する購入可能な商品）＝ 必ず `WebSearch`/`WebFetch` で検索した結果に基づく。検索していない商品名・価格を作り出さない。
7. **知識データ（`data/*.json`）とResources登録コード（`resources/*.ts`）は分離する。** データを足すだけでAIの参照できる知識が増える状態を保つ。

## コマンド

```bash
npm run dev         # tsx で直接起動（開発時）
npm run build       # tsc でビルド
npm run inspector   # ビルド後、MCP Inspector で動作確認
npm test            # vitest
npm run lint        # eslint
npm run web         # web/ をビルドして起動（ローカルWeb版）
```

## 配布用ランチャー（非エンジニア向け）

`Style Advisor を起動.command`（Mac）/ `Style Advisor を起動.bat` + `launcher.ps1`（Windows）が、
ダブルクリックだけで「Node.js確認 → 依存関係インストール・ビルド → Claude Codeログイン確認 →
サーバー起動 → ブラウザ自動起動」まで行う。認証は `web/scripts/claude-bin-path.mjs` で解決した
Claude Agent SDK 同梱バイナリの `claude auth status` / `claude auth login` を使う（グローバル
インストールや `sudo` は不要）。

**今後の課題（現状できていないこと）**
- **コード署名・公証（notarization）は未対応。** 初回起動時にMac/Windowsのセキュリティ警告が出る。
  Apple Developer Program（年会費）とWindows用コード署名証明書の取得が必要で、対応する場合は
  追加コストと手続きが発生する。
- **Windows版（`launcher.ps1`）はmacOS上で作成・レビューしたのみで、実機のWindowsでは未検証。**
  配布前に実機で必ず動作確認すること。
- **Node.jsランタイムは同梱していない。** 初回のみ、利用者のPCにNode.jsのインストールが必要
  （launcherが未インストールを検知した場合、公式ダウンロードページを自動で開く）。
