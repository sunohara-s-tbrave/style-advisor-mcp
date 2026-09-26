# Style Advisor MCP — 設計書

> 自己申告の身体的特徴から「似合う」ファッションを提案する MCP サーバー
> 実装言語: TypeScript / トランスポート: stdio / 対象クライアント: Claude Desktop・Claude Code

---

## 1. コンセプトと設計方針

### 1.1 一言でいうと
ユーザーが答えた質問（骨格・肌・体型バランス・好み・シーン）を **ルールベースで診断** し、その結果に基づいて **理由付きのコーディネート** を返す MCP サーバー。

### 1.2 最重要の設計判断：「LLM と MCP の役割分担」

| 役割 | 担当 | 理由 |
|---|---|---|
| ユーザーとの対話・質問の言い換え・自然な文章化 | LLM（Claude） | LLM が最も得意な領域 |
| 質問票の提供、診断ロジック、スコアリング、知識ベース | **MCP サーバー** | 結果の **再現性・説明可能性・テスト可能性** を担保 |

> **プロとしてのアドバイス**：MCP サーバー側で LLM を呼ばない設計にしてください。
> 「同じ回答なら必ず同じ診断になる」決定論的なロジックを持つことで、単体テストが書け、提出物としての品質（=エンジニアリングの説得力）が大きく上がります。
> LLM に全部任せる設計だと「プロンプトを書いただけ」に見えてしまいます。

### 1.3 設計原則
1. **ステートレス**：プロフィールは毎回引数で受け取る。サーバーは個人情報を保存しない。
2. **説明可能性**：すべての提案に `reasons`（なぜ似合うか）を付ける。
3. **ポジティブ表現**：体型の「欠点を隠す」ではなく「魅力を活かす」言葉を使う。
4. **知識とロジックの分離**：ファッション知識は JSON データ、判定は TypeScript。データだけ差し替えて拡張可能に。
5. **断定しない**：診断結果には `confidence`（確信度）を持たせ、低い場合は追加質問を促す。

---

## 2. 診断モデル（ドメイン設計）

業界で広く使われる3つのフレームワークを採用します。いずれも科学的に確立した分類ではないため、**「目安」として扱う旨を出力に含める**こと。

### 2.1 骨格タイプ（Body Frame）
| タイプ | 特徴 | 似合う方向性 |
|---|---|---|
| ストレート | 上重心・立体的・筋肉感 | シンプル、ジャストサイズ、ハリのある素材、Vネック |
| ウェーブ | 下重心・平面的・柔らかい | 華やか、ハイウエスト、柔らかい素材、装飾 |
| ナチュラル | 骨・関節がしっかり・フレーム感 | ゆったり、ラフ、天然素材、ロング丈 |

**判定方法**：7〜10問の選択式質問 → 各選択肢が3タイプへ点数を配分 → 合計スコアで判定。
上位2タイプの差が小さい場合は「ミックス」として両方を返す。

### 2.2 パーソナルカラー（簡易4シーズン）
| 軸 | 質問例 |
|---|---|
| アンダートーン（イエベ/ブルベ） | 手首の血管の色、似合うアクセサリー（ゴールド/シルバー）、日焼けの仕方 |
| 明度・彩度 | 瞳の色、髪の地毛の色、肌と瞳のコントラスト |

→ `spring / summer / autumn / winter` と、推奨カラーパレット・避けたい色を返す。

### 2.3 体型バランス（任意入力）
- 身長帯（例: 〜155 / 155–165 / 165–175 / 175〜 cm）
- 上半身と下半身の比率の自己評価、肩幅、首の長さ
- **体重・BMI は扱わない**（センシティブで、提案精度への寄与も小さい）

### 2.4 好み・コンテキスト
- 目指したい印象（きれいめ / カジュアル / モード / ナチュラル / 信頼感 …）
- シーン（通勤・オフィスカジュアル / 休日 / デート / 面接 / 冠婚葬祭）
- 季節・気温帯、予算帯、ジェンダー表現（メンズ / レディース / ユニセックス / 指定なし）

---

## 3. MCP インターフェース設計

### 3.1 Tools

| Tool 名 | 役割 | 主な入力 | 主な出力 |
|---|---|---|---|
| `get_questionnaire` | 診断用の質問票を返す | `category: "frame" \| "color" \| "balance" \| "all"` | 質問ID・質問文・選択肢の配列 |
| `diagnose_body_frame` | 骨格タイプ判定 | `answers: {questionId, optionId}[]` | `type`, `scores`, `confidence`, `traits`, `followUpQuestions?` |
| `diagnose_personal_color` | パーソナルカラー判定 | `answers` | `season`, `undertone`, `palette`, `avoidColors`, `confidence` |
| `recommend_outfits` | コーデ提案（メイン機能） | `profile`, `occasion`, `season`, `budget?`, `preferredImpression?`, `count?` | コーデ配列（アイテム構成・色・素材・シルエット・`reasons`） |
| `evaluate_item` | 手持ち/購入検討アイテムの相性判定 | `profile`, `item: {category, silhouette, material, color, neckline?, length?}` | `score (0–100)`, `goodPoints`, `cautions`, `stylingTips` |

> ツール数は **5つ前後** に抑えるのがポイント。多すぎると LLM がツール選択を誤りやすくなります。

### 3.2 Resources（参照用の知識）
| URI | 内容 |
|---|---|
| `style://guides/frame/{type}` | 骨格タイプ別ガイド（得意・苦手アイテム一覧） |
| `style://palettes/{season}` | シーズン別カラーパレット（HEX付き） |
| `style://occasions/{occasion}` | シーン別ドレスコードの基本ルール |

### 3.3 Prompts（ユーザー向けの入口）
| Prompt 名 | 内容 |
|---|---|
| `style_consultation` | 「質問票取得 → 診断 → 提案」の一連の流れを Claude に案内するテンプレート |
| `quick_outfit` | 診断済みプロフィールを貼り付けて、シーン指定で即提案 |

> Prompts を用意すると、Claude Desktop のメニューから「スタイル相談を開始」のように呼び出せて、**デモ映えが格段に良くなります**。

### 3.4 想定される対話フロー
```
ユーザー: 「似合う服を提案してほしい」
Claude  → get_questionnaire(category="all")
Claude  : 質問を1〜3問ずつ自然な会話で聞く
Claude  → diagnose_body_frame(answers)
Claude  → diagnose_personal_color(answers)
Claude  : 「ストレート×夏タイプの傾向です（確信度: 中）」
ユーザー: 「来週の取引先訪問に着ていく服は？」
Claude  → recommend_outfits(profile, occasion="business", season="autumn")
Claude  : 理由付きで3パターン提案
```

---

## 4. データモデル（zod スキーマ概要）

```ts
// src/schemas/profile.ts
export const FrameType = z.enum(["straight", "wave", "natural"]);
export const ColorSeason = z.enum(["spring", "summer", "autumn", "winter"]);

export const StyleProfile = z.object({
  frame: z.object({
    primary: FrameType,
    secondary: FrameType.optional(),     // ミックス判定用
    confidence: z.enum(["high", "medium", "low"]),
  }),
  color: z.object({
    season: ColorSeason,
    undertone: z.enum(["yellow", "blue"]),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  balance: z.object({
    heightRange: z.enum(["xs", "s", "m", "l"]).optional(),
    upperLowerRatio: z.enum(["upper", "even", "lower"]).optional(),
    shoulder: z.enum(["narrow", "average", "wide"]).optional(),
  }).optional(),
  preference: z.object({
    impressions: z.array(z.string()).max(3).optional(),
    genderExpression: z.enum(["mens", "womens", "unisex", "any"]).default("any"),
    ngItems: z.array(z.string()).optional(),   // 着たくないもの
  }).optional(),
});

// src/schemas/outfit.ts
export const OutfitItem = z.object({
  category: z.enum(["tops", "bottoms", "outer", "dress", "shoes", "bag", "accessory"]),
  name: z.string(),              // 例: "ハイゲージVネックニット"
  color: z.object({ name: z.string(), hex: z.string() }),
  material: z.string(),
  silhouette: z.string(),
});

export const Outfit = z.object({
  title: z.string(),             // 例: "信頼感のあるきれいめオフィスコーデ"
  items: z.array(OutfitItem),
  reasons: z.array(z.string()),  // 骨格・カラー・シーンそれぞれの根拠
  tips: z.array(z.string()),
});
```

---

## 5. 推薦エンジンのロジック

### 5.1 アイテム知識ベース（JSON）
```jsonc
// src/data/items.json（抜粋）
{
  "id": "tops-vneck-highgauge-knit",
  "category": "tops",
  "name": "ハイゲージVネックニット",
  "attributes": { "silhouette": "just", "material": "wool-smooth", "neckline": "v" },
  "frameFit": { "straight": 3, "wave": 1, "natural": 1 },  // 0–3
  "occasions": ["business", "casual", "date"],
  "seasons": ["autumn", "winter", "spring"],
  "impressions": ["clean", "trust"],
  "gender": ["any"]
}
```

### 5.2 スコアリング
```
score(item) =
    w1 * frameFit[primary]                // 骨格適合（最重要）
  + w2 * frameFit[secondary] * 0.5        // ミックス時の補正
  + w3 * occasionMatch                    // シーン適合（不一致は除外）
  + w4 * seasonMatch
  + w5 * impressionMatch
  - penalty(ngItems)
```
1. シーン・季節・ジェンダーで **フィルタ**
2. カテゴリ別に上位アイテムを抽出
3. `tops + bottoms (+ outer) + shoes` を組み合わせ、**色の組み合わせルール**（パレット内・3色以内・ベースカラー/アソートカラー/アクセントカラー）で検証
4. 多様性確保：同じアイテムを複数コーデで使い回しすぎない
5. 各選定理由を `reasons` に文字列として積む（←説明可能性の肝）

### 5.3 色の扱い
- アイテムの色は「固定」ではなく、**パレットから推薦色を割り当てる**方式にするとデータ量を抑えられる。
- 例：「Vネックニット」×「夏タイプ」→ ラベンダー / スモーキーブルー / ライトグレー

---

## 6. ディレクトリ構成

```
style-advisor-mcp/
├── CLAUDE.md                 # Claude Code 向けの開発ルール
├── DESIGN.md                 # 本設計書
├── README.md                 # セットアップ・使い方・デモ
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # エントリポイント（stdio 接続）
│   ├── server.ts             # McpServer 生成・登録
│   ├── tools/
│   │   ├── getQuestionnaire.ts
│   │   ├── diagnoseBodyFrame.ts
│   │   ├── diagnosePersonalColor.ts
│   │   ├── recommendOutfits.ts
│   │   └── evaluateItem.ts
│   ├── resources/
│   ├── prompts/
│   ├── engine/               # 純粋関数のみ（MCP 非依存）
│   │   ├── frameDiagnosis.ts
│   │   ├── colorDiagnosis.ts
│   │   ├── scoring.ts
│   │   └── outfitBuilder.ts
│   ├── schemas/
│   └── data/
│       ├── questions.json
│       ├── items.json
│       ├── palettes.json
│       └── occasions.json
└── tests/
    ├── engine/               # 診断・スコアリングの単体テスト
    └── tools/                # ツール入出力の結合テスト
```

> **ポイント**：`engine/` を MCP から完全に切り離すこと。ロジックは純粋関数としてテストでき、将来 Web API や Slack Bot にも転用できます。

---

## 7. 技術スタック

| 項目 | 選定 |
|---|---|
| ランタイム | Node.js 20 LTS 以上 |
| MCP SDK | `@modelcontextprotocol/sdk`（公式 TypeScript SDK） |
| バリデーション | `zod` |
| テスト | `vitest` |
| Lint/Format | `eslint` + `prettier`（または `biome`） |
| 動作確認 | MCP Inspector（`npx @modelcontextprotocol/inspector`） |

### 実装上の注意（ハマりどころ）
- **stdio トランスポートでは `console.log` 禁止**。標準出力は JSON-RPC 通信に使われるため、ログは `console.error`（stderr）へ。
- ツールの `description` は **LLM が読む仕様書**。「いつ使うか」「前提となる他ツール」まで書く。
  - 例：`recommend_outfits` → 「diagnose_body_frame と diagnose_personal_color の結果から作った profile を渡すこと」
- エラーは例外で落とさず、`isError: true` と「何が足りないか」を返すと LLM が自己修正できる。
- `data/*.json` はビルド時に同梱されるよう `tsconfig` / import 設定を確認。

---

## 8. プライバシー・倫理配慮（社内提出で評価されるポイント）

| 項目 | 対応 |
|---|---|
| 個人情報の保存 | しない（ステートレス、ファイル・DB 書き込みなし） |
| ログ | 回答内容・プロフィールをログ出力しない |
| 外部通信 | MVP では一切なし（完全ローカル動作） |
| センシティブ情報 | 体重・BMI・年齢は入力項目に含めない |
| 表現 | 「隠す」「ごまかす」「太って見える」等のネガティブ語を知識データに使わない |
| 多様性 | ジェンダー表現を選択式＋「指定なし」を用意。性別で提案を固定しない |
| 免責 | 診断結果に「一般的な傾向に基づく目安です」を付与 |

---

## 9. 開発マイルストーン

| フェーズ | 内容 | 目安 |
|---|---|---|
| **Phase 0** | プロジェクト雛形、MCP Inspector で hello ツールが動く | 0.5日 |
| **Phase 1 (MVP)** | 質問票・骨格診断・カラー診断・コーデ提案（items 40〜60件） | 3〜4日 |
| **Phase 2** | `evaluate_item`、Resources、Prompts、テスト拡充 | 2日 |
| **Phase 3** | README・デモ動画/スクショ・Claude Desktop 接続手順 | 1日 |
| 拡張案 | 天気 API 連携で当日の気温に合わせた提案 / ワードローブ登録 / 写真入力（同意取得前提） | 任意 |

---

## 10. 提出物として仕上げるためのアドバイス

1. **README に「デモ会話ログ」を載せる** — 実際に Claude Desktop で相談した会話のスクリーンショットが最も伝わります。
2. **テストカバレッジを示す** — `engine/` の単体テストで「同じ回答→同じ診断」を保証していることをアピール。
3. **設計判断の理由を書く** — 「なぜ LLM に全部任せなかったか」「なぜ写真を使わなかったか（プライバシー）」は評価者に響きます。
4. **知識データの拡張性を見せる** — 「items.json にアイテムを足すだけで提案が増える」ことを README に明記。
5. **スコープを広げすぎない** — まずは MVP を確実に完成させ、拡張案は「今後の展望」として書く方が評価は高くなりがちです。

---

## 11. Claude Code への最初の依頼文（コピペ用）

```
このフォルダの DESIGN.md を読んで、style-advisor-mcp を実装してください。
進め方:
1. まず Phase 0（雛形作成・MCP Inspector で動作確認できる状態）まで進めて止まってください。
2. engine/ は MCP に依存しない純粋関数として実装し、vitest でテストを書いてください。
3. stdio トランスポートのため console.log は使わず、ログは console.error にしてください。
4. 各フェーズ完了ごとに変更内容を要約して、次に進むか確認してください。
```
