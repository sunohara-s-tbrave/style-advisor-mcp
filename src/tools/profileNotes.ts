import { z } from "zod";
import fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// A thin, deterministic read/write bridge to one local file. The AI decides
// what to write and how to structure it; this tool has no diagnosis logic of
// its own, it only persists whatever Markdown the AI composes.
export function registerProfileNotesTools(server: McpServer, profilePath: string): void {
  server.registerTool(
    "get_profile_notes",
    {
      title: "プロフィールメモを読む",
      description:
        "会話の中で分かった、ユーザー本人および相談対象になった周りの人（家族・パートナー・友人など）についての情報（骨格タイプ・パーソナルカラー・好み・性格・よく使う場面など）を記録したローカルのMarkdownファイルを読み込む。新しい会話の最初や、既知の情報を思い出したいときに呼ぶこと。",
      inputSchema: {},
    },
    async () => {
      const content = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, "utf-8") : "";
      return {
        content: [{ type: "text", text: content || "(まだ何も記録されていません)" }],
      };
    },
  );

  server.registerTool(
    "save_profile_notes",
    {
      title: "プロフィールメモを保存",
      description:
        "ユーザー本人や、相談対象になった周りの人について新しく分かったこと・変わったことを反映し、Markdown全文を上書き保存する。呼ぶ前に get_profile_notes で現在の内容を確認し、それを踏まえて全体を書き直すこと（差分ではなく全文を渡す）。複数人の情報を扱う場合は、誰についての記述かが分かるよう見出しを分けること。",
      inputSchema: {
        content: z.string().describe("保存するMarkdown全文（既存の内容を踏まえた上での全文）"),
      },
    },
    async ({ content }) => {
      fs.writeFileSync(profilePath, content, "utf-8");
      return { content: [{ type: "text", text: "保存しました。" }] };
    },
  );
}
