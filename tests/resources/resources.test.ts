import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function connectedClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("frame guide resources", () => {
  it("lists all three frame types", async () => {
    const client = await connectedClient();
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toContain("style://guides/frame/{type}");
  });

  it("reads a known frame type", async () => {
    const client = await connectedClient();
    const result = await client.readResource({ uri: "style://guides/frame/straight" });
    const text = String(result.contents[0]?.text);
    expect(text).toContain("ストレート");
    expect(text).toContain("Vネックニット");
  });

  it("rejects an unknown frame type", async () => {
    const client = await connectedClient();
    await expect(client.readResource({ uri: "style://guides/frame/unknown" })).rejects.toThrow();
  });
});

describe("palette resources", () => {
  it("reads a known season with hex codes", async () => {
    const client = await connectedClient();
    const result = await client.readResource({ uri: "style://palettes/summer" });
    const text = String(result.contents[0]?.text);
    expect(text).toContain("サマー");
    expect(text).toContain("#");
  });
});

describe("occasion resources", () => {
  it("reads a known occasion", async () => {
    const client = await connectedClient();
    const result = await client.readResource({ uri: "style://occasions/business" });
    const text = String(result.contents[0]?.text);
    expect(text).toContain("オフィスカジュアル");
  });
});
