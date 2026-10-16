import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import Database from "better-sqlite3";
import { LATEST_VERSION, createGrillCore, grillTools, migrate, schemaVersion } from "./index.js";

/** A host as ferlabs would write it: its own connection, its own MCP server. */
function host() {
  const db = new Database(":memory:");
  migrate(db);
  const grill = createGrillCore(db);
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "host", version: "0.0.0" });
    for (const { name, title, description, inputSchema, handler } of grillTools(grill)) {
      server.registerTool(name, { title, description, inputSchema }, handler);
    }
    return server;
  });
  return {
    db,
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      handler.fetch(new Request(input, init)),
  };
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const [block] = result.content as Array<{ type: string; text: string }>;
  assert.equal(result.isError, undefined, block?.text);
  return block!.text;
}

test("a host runs a whole grill through the library tools", async () => {
  const { db, fetch } = host();
  const client = new Client({ name: "agent", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://host.test/mcp"), { fetch }),
  );

  const topic = JSON.parse(
    await call(client, "create_topic", { title: "Ship the core", categories: ["scope"] }),
  );
  const round = JSON.parse(await call(client, "create_round", { topicId: topic.id }));
  await call(client, "add_questions", {
    topicId: topic.id,
    roundId: round.id,
    questions: [{ category: "scope", text: "Library or fork?" }],
  });
  await call(client, "answer_question", {
    topicId: topic.id,
    questionId: "q1",
    answer: "Library",
  });

  assert.equal(
    await call(client, "export_answers", { topicId: topic.id }),
    "## Answers — Ship the core\n\n- **q1** (round 1): Library",
  );

  migrate(db);
  assert.equal(schemaVersion(db), LATEST_VERSION);
  assert.equal(createGrillCore(db).listTopics().length, 1);
  await client.close();
});
