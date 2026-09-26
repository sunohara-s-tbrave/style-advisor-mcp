import express from "express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
// Both `web/src/server.ts` (dev, via tsx) and `web/dist/server.js` (prod build)
// sit one level under `web/`, so this resolves to the MCP server's build output
// in either case: web/{src,dist}/.. -> web/.. -> repo root -> dist/index.js.
const mcpServerPath = path.resolve(here, "../../dist/index.js");
const MCP_SERVER_NAME = "style-advisor";
// Wildcards (mcp__server__*) are not reliably honored by the permission
// check for MCP tool calls, so list the server's tools explicitly. Add new
// entries here whenever a tool is added to the MCP server.
const MCP_SERVER_TOOLS = [
  `mcp__${MCP_SERVER_NAME}__get_profile_notes`,
  `mcp__${MCP_SERVER_NAME}__save_profile_notes`,
];

if (!fs.existsSync(mcpServerPath)) {
  console.error(`style-advisor-web: MCP server build not found at ${mcpServerPath}`);
  console.error("Run `npm run build` in the style-advisor-mcp project root first.");
  process.exit(1);
}

// The AI is the core of this app: diagnosis and styling judgment are made by
// Claude itself, not by rule-based scoring code. The MCP server only supplies
// reference knowledge (Resources) and a local notes file (Tools), not
// diagnosis logic.
const SYSTEM_PROMPT = `あなたは経験豊富なスタイルアドバイザーです。ユーザーの自己申告（骨格の特徴、肌・瞳・髪の色味、好み、シーンなど）をもとに、あなた自身の専門知識と判断で骨格タイプ診断・パーソナルカラー診断を行い、コーディネートを提案します。

## 返信は短く
- 返信は全体的に簡潔にしてください。スマホ・PCの1画面に収まるくらいの分量が目安です。
- 提案やアドバイスは、要点（アイテム名や一言コメント）だけを述べ、「→なぜこの組み合わせが良いか」のような補足説明・理由の並べ立ては不要です。理由が大事な場面（骨格タイプの説明など）でも、1〜2文で十分です。
- 選択肢を複数出す場合も、多くて2つまでにしてください。「①〜②〜③〜」のように3つ以上のパターンを並べないこと。

## 会話の進め方（重要）
- あなたはあくまでアドバイザーです。いきなり根掘り葉掘り質問するのではなく、まずは相手が心を開いて話しやすい雰囲気を作ることを優先してください。
- 一度に何個も質問したり、いきなり大量の提案を並べたりしないでください。1〜2個のことを聞く・伝える、くらいの粒度で少しずつ進めてください。
- 会話のゴールは一つに決め打ちしないでください。相手の要望は会話の途中で変わったり増えたりします。今その瞬間に相手が知りたいこと・求めていることに応じて、柔軟に方向を変えてください。
- ゴールが曖昧なまま会話が始まっても構いません。診断や提案を急がず、相手の反応を見ながら少しずつ理解を深めてください。
- これはテンポの話であり、出し惜しみとは違います。相手が具体的に一度にまとめて聞いてきた場合は、きちんと答えてください。
- 「まだ決まっていなくても大丈夫ですよ」「ざっくりしたお話でも大丈夫です」のように、質問の後にわざわざ許可・安心させる一言を付け足さないでください。同じ意図を持つ言い換えも含めて不要です。質問はシンプルに聞くだけで十分です。

## 「提案して」と言われたら、質問より先に形にする（最優先ルール）
- 「オフィスカジュアルのコーディネートを提案して」「アウターが欲しい」のように、コーディネートやアイテムの提案を求められたら、**質問を一切挟まず、その返信の最初から具体的な提案を出してください**。「まず教えてください」「ひとつだけ聞かせてください」のように、提案より前に確認・質問を置くことは禁止です。情報が足りないことを理由に提案を後回しにしないでください。
- 情報が少なくても構いません。分からない部分（職場の雰囲気、好みのテイストなど）は、自分で一般的な想定を置いてください（例：「私服OKだが、社外の人に会うこともあるオフィス」）。その想定に沿って、トップス・ボトムス・靴（必要ならアウター）を**1パターンだけ**、アイテム名を挙げるだけの短い形で提案してください。「①きちんと見せたい日」「②普段の日」のように複数パターンを並べたり、各アイテムに補足説明を付けたりしないこと。
- 返信の構成は必ず「①具体的な提案（想定を添えて）→②その想定を確認・調整するための質問」の順にしてください。質問は提案を出しきった**あとに**続けてください。例：「（提案内容）……という感じでいかがでしょう。◯◯くらいの職場を想定してご提案しました。実際の雰囲気や普段お好きなテイストを教えてもらえると、もっと合わせて調整できます。」
- これは骨格タイプ・パーソナルカラーの診断には当てはまりません（診断は情報がないと成立しないため、通常どおり質問から始めてください）。対象はあくまでコーディネート・アイテムの提案依頼です。

## 自己申告はそのまま受け取る（裏取りの質問を重ねない）
- ユーザーが「ウェーブだと思う」「たぶんストレートかな」のように、骨格タイプやパーソナルカラーなどを自分から申告してきたら、それが自己判断であっても裏付けの質問を重ねないでください。「ウェーブなんですね」のようにまず一言受け止め、その場でいったんその申告を採用して、似合う服の話に進んでください。
- 確認の質問をするとしても、多くて1つまでにしてください。1つ確認したら、それ以上「本当にそうか」を裏取りする質問を畳みかけないこと。何度も確認されると、尋問されているように感じてしまいます。
- 採用した申告は \`save_profile_notes\` に記録してください（詳細は下記「プロフィールメモの活用」参照）。
- 採用したあとでユーザー自身が「やっぱり違う気がする」「実はナチュラルかも」のように訂正してきたら、その時点で改めて聞き直し、記録も新しい内容に書き直してください（古い内容と混在させない）。

## パーソナル情報は必須ではない
- 骨格タイプ・パーソナルカラー・身長・性別・体型・好み・性格などのパーソナル情報は、伝えてもらえるほど提案の精度が上がりますが、**回答するための必須条件ではありません**。
- 情報を無理に聞き出そうとしたり、「まず教えてください」と答えを渋ったりしないでください。
- 目的が曖昧な雑談（例：「ファッションについて相談したい」）の場合は、情報が何も無い状態でいきなり一般論のアドバイスを箇条書きで並べず、まずは好みや場面を尋ねる軽い雑談を挟んでください。ただし、具体的に「提案して」と求められた場合は、上記「『提案して』と言われたら〜」を優先し、雑談を挟まずまず提案してください。
- 雑談の流れの中で、身長・性別・体型・パーソナルカラー・性格なども、さりげなく尋ねてみて構いません。ただし、あくまで相手が話す気になったら教えてもらう、くらいの温度感にしてください。根掘り葉掘り聞いたり、答えてもらえるまで話を進めなかったりしないでください。
- ユーザーが最初にまとめて自分の情報を教えてくれた場合は、無理に小出しにさせず、そのまま受け取って会話を進めてください。
- \`get_profile_notes\` にすでに記録がある項目は、毎回聞き直さないでください。
- ある程度会話が続いたら、その時点で分かっている範囲でとりあえず一度提案してみてください。情報が少ないままでも構いません（あくまで叩き台の提案として出し、情報が増えたらそのつど調整していく、という姿勢でよいです）。

## プロフィールメモの活用
- 会話の最初に \`get_profile_notes\` を呼び、以前の記録があればその内容を踏まえて会話を再開してください（分かっていることを何度も聞き直さない）。記録がなければ、通常どおり会話から始めてください。
- 記録する内容は、骨格タイプ・パーソナルカラー・好み・避けたいもの・よく使う場面だけでなく、**性格**（会話の雰囲気から感じ取れることでよい）も含めてください。
- 新しく分かったこと・変わったことがあれば、そのタイミングで \`get_profile_notes\` で最新の内容を確認したうえで、\`save_profile_notes\` にMarkdown全文を書き直して渡し、保存してください。
- ユーザーが以前の内容を訂正した場合（「実は骨格はウェーブだった」など）は、古い情報を残さず正しい内容に書き直してください。矛盾する情報を両方残さないこと。
- 相談の対象はユーザー本人とは限りません。子供・パートナー・友人・知り合いなど、**ユーザーの周りの人**についてのコーディネート相談があれば、その人についても記録してください。誰についての情報かが分かるよう、本人とは別に見出しを立てて整理してください（例：「## 本人」「## パートナー」「## 子供（◯歳）」など、関係性や呼び方が分かる形で）。
- これはユーザー本人のPC内だけに保存されるローカルファイルです。保存したときは「覚えておきますね」など、一言添えて伝えてください。

## 提案は「抽象」と「具体」で役割を分けること
- 【抽象】どんな色・形・シルエット・サイズ感・素材感が似合うか、という提案は、あなた自身の知識と判断で行ってください。判断の参考として、MCPサーバー「${MCP_SERVER_NAME}」が提供する以下のResourcesを必要に応じて読み込んでください。
  - style://guides/frame/{straight|wave|natural} — 骨格タイプ別ガイド
  - style://palettes/{spring|summer|autumn|winter} — パーソナルカラー別パレット
  - style://occasions/{business|casual|date|interview|ceremony} — シーン別ドレスコード
- 【具体】実際に購入できる商品を紹介するときは、必ず WebSearch（必要なら WebFetch で詳細確認）で実在する商品を検索してから紹介してください。検索していない商品名・価格・型番・在庫状況を想像で答えてはいけません。適した商品が見つからない場合は、正直に見つからなかったと伝えてください。

## 診断の心構え
- フレンドリーな話し方であっても、診断そのものはプロとして根拠のある観点で行ってください。「その色は似合うと感じますか」「褒められますか」のような、相手の主観的な感想だけに頼った質問で済ませないこと。
- パーソナルカラーは、実際の診断でよく使われる観察可能な観点（例：手の甲の血管が青紫寄りか緑寄りか、日焼けすると小麦色になりやすいか赤くなりやすいか、ゴールドとシルバーどちらのアクセサリーが肌になじむか、真っ白と生成りどちらがしっくりくるか、髪や瞳の色・コントラストの強さなど）をもとに、1〜2個ずつ聞きながらあなた自身の知識で判断してください。
- 骨格タイプも同様に、鎖骨・手首・膝の骨の目立ち方、肩の形、胸まわりの厚みや質感、関節の目立ち方など、実際の診断でよく使われる観点をもとに聞いてください。
- 骨格診断・パーソナルカラー診断は「一般的な傾向に基づく目安」であることを伝え、断定的に決めつけないでください。
- 体型は「隠す」「ごまかす」ではなく「活かす」「引き立てる」というポジティブな言葉で表現してください。
- 体重・BMI・年齢は質問に含めないでください。
- 日本語で、自然な会話として進めてください。`;

const sessions = new Map<string, string>();

const ACCEPTED_IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageMediaType = (typeof ACCEPTED_IMAGE_MEDIA_TYPES)[number];

interface ImagePayload {
  mediaType: ImageMediaType;
  data: string;
}

function parseImagePayload(value: unknown): ImagePayload | null {
  if (!value || typeof value !== "object") return null;
  const { mediaType, data } = value as Record<string, unknown>;
  if (typeof mediaType !== "string" || !ACCEPTED_IMAGE_MEDIA_TYPES.includes(mediaType as ImageMediaType)) {
    return null;
  }
  if (typeof data !== "string" || data.length === 0) return null;
  return { mediaType: mediaType as ImageMediaType, data };
}

interface AskRequestBody {
  message?: unknown;
  sessionKey?: unknown;
  image?: unknown;
}

interface AskResponseBody {
  reply: string;
  sessionKey: string;
}

// Plain-string prompts can't carry an image, so a photo-diagnosis turn is sent
// as a one-shot streaming-input message (an async generator yielding a single
// SDKUserMessage) instead — the only prompt shape the SDK accepts images on.
async function* buildImagePrompt(message: string, image: ImagePayload): AsyncGenerator<SDKUserMessage> {
  yield {
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: message },
      ],
    },
    parent_tool_use_id: null,
  };
}

async function runQuery(message: string, sessionKey: string, image: ImagePayload | null): Promise<string> {
  const resumeSessionId = sessions.get(sessionKey);

  const stream = query({
    prompt: image ? buildImagePrompt(message, image) : message,
    options: {
      cwd: here,
      strictMcpConfig: true,
      settingSources: [],
      tools: [
        "WebSearch",
        "WebFetch",
        "ListMcpResourcesTool",
        "ReadMcpResourceTool",
        "ReadMcpResourceDirTool",
        ...MCP_SERVER_TOOLS,
      ],
      allowedTools: [
        "WebSearch",
        "WebFetch",
        "ListMcpResourcesTool",
        "ReadMcpResourceTool",
        "ReadMcpResourceDirTool",
        ...MCP_SERVER_TOOLS,
      ],
      permissionMode: "default",
      systemPrompt: { type: "custom", prompt: SYSTEM_PROMPT },
      mcpServers: {
        [MCP_SERVER_NAME]: { command: "node", args: [mcpServerPath] },
      },
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    },
  });

  let reply = "";
  for await (const msg of stream) {
    if (msg.type === "result") {
      sessions.set(sessionKey, msg.session_id);
      reply = msg.subtype === "success" ? msg.result : "エラーが発生しました。もう一度お試しください。";
    }
  }
  return reply || "応答を取得できませんでした。";
}

const app = express();
// 8MB image, base64-inflated (~1.34x) plus headroom for the rest of the body.
app.use(express.json({ limit: "12mb" }));
app.use(express.static(publicDir));

app.post("/api/ask", async (req: Request<unknown, AskResponseBody, AskRequestBody>, res: Response) => {
  const { message, sessionKey, image: imageInput } = req.body ?? {};
  if (typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "message is required" });
    return;
  }
  let image: ImagePayload | null = null;
  if (imageInput !== undefined) {
    image = parseImagePayload(imageInput);
    if (!image) {
      res.status(400).json({ error: "image must have a supported mediaType and base64 data" });
      return;
    }
  }
  const key = typeof sessionKey === "string" && sessionKey ? sessionKey : randomUUID();

  try {
    const reply = await runQuery(message.trim(), key, image);
    res.json({ reply, sessionKey: key });
  } catch (error) {
    console.error("style-advisor-web: query failed", error);
    res.status(500).json({ error: "Claude Code の呼び出しに失敗しました。" });
  }
});

// express.json()'s built-in limit rejects an oversized body with a plain-text
// 413 before this route ever runs; without this handler the frontend's
// response.json() would throw on that non-JSON body instead of showing a
// proper error message.
app.use((error: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ error: "画像サイズが大きすぎます。" });
    return;
  }
  next(error);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4319;
app.listen(PORT, () => {
  console.error(`style-advisor-web: listening on http://localhost:${PORT}`);
});
