import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import occasions from "../data/occasions.json" with { type: "json" };

type Occasion = keyof typeof occasions;

const OCCASIONS = Object.keys(occasions) as Occasion[];

function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as string[]).includes(value);
}

function firstValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function renderOccasion(occasion: Occasion): string {
  const entry = occasions[occasion];
  return [
    `# シーン: ${entry.label}`,
    "",
    "## 基本の考え方",
    entry.guideline,
    "",
    "## ポイント",
    ...entry.goodPoints.map((s) => `- ${s}`),
  ].join("\n");
}

export function registerOccasionResources(server: McpServer): void {
  server.registerResource(
    "occasion-guide",
    new ResourceTemplate("style://occasions/{occasion}", {
      list: async () => ({
        resources: OCCASIONS.map((occasion) => ({
          uri: `style://occasions/${occasion}`,
          name: `シーン別ガイド: ${occasions[occasion].label}`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "シーン別ドレスコードの基本ルール",
      description: "business/casual/date/interview/ceremony など、シーンごとの服装の考え方の参考資料。",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const occasion = firstValue(variables.occasion);
      if (!isOccasion(occasion)) {
        throw new Error(`Unknown occasion: ${occasion}. Expected one of: ${OCCASIONS.join(", ")}`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: renderOccasion(occasion) }],
      };
    },
  );
}
