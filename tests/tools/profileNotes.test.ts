import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

let profilePath: string;

beforeEach(() => {
  profilePath = path.join(os.tmpdir(), `style-advisor-profile-test-${Date.now()}-${Math.random()}.md`);
});

afterEach(() => {
  if (fs.existsSync(profilePath)) fs.rmSync(profilePath);
});

async function connectedClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(profilePath);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("profile notes tools", () => {
  it("reports nothing recorded when the file does not exist yet", async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: "get_profile_notes", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("まだ何も記録されていません");
  });

  it("saves content to the local file and reads it back", async () => {
    const client = await connectedClient();
    await client.callTool({
      name: "save_profile_notes",
      arguments: { content: "# プロフィール\n\n- 骨格: ストレート" },
    });

    expect(fs.existsSync(profilePath)).toBe(true);
    expect(fs.readFileSync(profilePath, "utf-8")).toContain("骨格: ストレート");

    const result = await client.callTool({ name: "get_profile_notes", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("骨格: ストレート");
  });

  it("overwrites the previous content on a second save", async () => {
    const client = await connectedClient();
    await client.callTool({ name: "save_profile_notes", arguments: { content: "v1" } });
    await client.callTool({ name: "save_profile_notes", arguments: { content: "v2" } });

    expect(fs.readFileSync(profilePath, "utf-8")).toBe("v2");
  });
});
