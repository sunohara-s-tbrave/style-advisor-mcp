import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFrameGuideResources } from "./resources/frameGuides.js";
import { registerPaletteResources } from "./resources/palettes.js";
import { registerOccasionResources } from "./resources/occasions.js";
import { registerProfileNotesTools } from "./tools/profileNotes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// Both src/server.ts (dev) and dist/server.js (build) sit one level under the
// repo root, so this resolves to the same place either way.
const DEFAULT_PROFILE_PATH = path.resolve(here, "../profile.md");

export function createServer(profilePath: string = DEFAULT_PROFILE_PATH): McpServer {
  const server = new McpServer({
    name: "style-advisor-mcp",
    version: "0.3.0",
  });

  registerFrameGuideResources(server);
  registerPaletteResources(server);
  registerOccasionResources(server);
  registerProfileNotesTools(server, profilePath);

  return server;
}
