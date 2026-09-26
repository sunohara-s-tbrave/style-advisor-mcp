import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for JSON-RPC; all diagnostics go to stderr.
  console.error("style-advisor-mcp: connected over stdio");
}

main().catch((error) => {
  console.error("style-advisor-mcp: fatal error", error);
  process.exit(1);
});
