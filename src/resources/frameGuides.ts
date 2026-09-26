import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import frameGuides from "../data/frameGuides.json" with { type: "json" };

type FrameType = keyof typeof frameGuides;

const FRAME_TYPES = Object.keys(frameGuides) as FrameType[];

function isFrameType(value: string): value is FrameType {
  return (FRAME_TYPES as string[]).includes(value);
}

function firstValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function renderGuide(type: FrameType): string {
  const guide = frameGuides[type];
  return [
    `# 骨格タイプ: ${guide.label}`,
    "",
    "一般的な傾向に基づく目安です。断定するものではありません。",
    "",
    "## 特徴",
    guide.features,
    "",
    "## 活かし方",
    ...guide.strengths.map((s) => `- ${s}`),
    "",
    "## 似合うアイテムの例",
    ...guide.recommendedItems.map((s) => `- ${s}`),
    "",
    "## スタイリングのヒント",
    ...guide.stylingTips.map((s) => `- ${s}`),
  ].join("\n");
}

export function registerFrameGuideResources(server: McpServer): void {
  server.registerResource(
    "frame-guide",
    new ResourceTemplate("style://guides/frame/{type}", {
      list: async () => ({
        resources: FRAME_TYPES.map((type) => ({
          uri: `style://guides/frame/${type}`,
          name: `骨格タイプガイド: ${frameGuides[type].label}`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "骨格タイプ別スタイルガイド",
      description:
        "ストレート・ウェーブ・ナチュラルそれぞれの特徴と、似合う方向性（アイテム・素材・シルエット）の参考資料。",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const type = firstValue(variables.type);
      if (!isFrameType(type)) {
        throw new Error(`Unknown frame type: ${type}. Expected one of: ${FRAME_TYPES.join(", ")}`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: renderGuide(type) }],
      };
    },
  );
}
