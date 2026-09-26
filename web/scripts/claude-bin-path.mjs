import fs from "node:fs";
import path from "node:path";

const anthropicDir = path.resolve(import.meta.dirname, "../node_modules/@anthropic-ai");

const platformPkg = fs
  .readdirSync(anthropicDir, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith("claude-agent-sdk-"));

if (!platformPkg) {
  console.error("style-advisor-web: no platform-specific Claude Code binary found under node_modules/@anthropic-ai");
  console.error("Run `npm install` in web/ first.");
  process.exit(1);
}

const binName = process.platform === "win32" ? "claude.exe" : "claude";
const binPath = path.join(anthropicDir, platformPkg.name, binName);

if (!fs.existsSync(binPath)) {
  console.error(`style-advisor-web: expected Claude Code binary not found at ${binPath}`);
  process.exit(1);
}

console.log(binPath);
