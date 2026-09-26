import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import palettes from "../data/palettes.json" with { type: "json" };

type Season = keyof typeof palettes;

const SEASONS = Object.keys(palettes) as Season[];

function isSeason(value: string): value is Season {
  return (SEASONS as string[]).includes(value);
}

function firstValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function renderPalette(season: Season): string {
  const palette = palettes[season];
  return [
    `# パーソナルカラー: ${palette.label}`,
    "",
    "一般的な傾向に基づく目安です。断定するものではありません。",
    "",
    "## 特徴",
    palette.characteristics,
    "",
    "## 似合う色の例",
    ...palette.recommended.map((c) => `- ${c.name} (${c.hex})`),
    "",
    "## 使い方のヒント",
    palette.accentAdvice,
    "",
    "## アクセサリー",
    palette.accessory,
  ].join("\n");
}

export function registerPaletteResources(server: McpServer): void {
  server.registerResource(
    "color-palette",
    new ResourceTemplate("style://palettes/{season}", {
      list: async () => ({
        resources: SEASONS.map((season) => ({
          uri: `style://palettes/${season}`,
          name: `パーソナルカラーパレット: ${palettes[season].label}`,
          mimeType: "text/markdown",
        })),
      }),
    }),
    {
      title: "シーズン別パーソナルカラーパレット",
      description: "spring/summer/autumn/winter の4シーズンごとの推奨カラー（HEX付き）とアクセサリーの傾向。",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const season = firstValue(variables.season);
      if (!isSeason(season)) {
        throw new Error(`Unknown season: ${season}. Expected one of: ${SEASONS.join(", ")}`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: renderPalette(season) }],
      };
    },
  );
}
