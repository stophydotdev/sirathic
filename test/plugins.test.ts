import { expect, mock, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import { z } from "zod";
import { writingTools } from "../apps/server/src/chat/confirm";
import { seal } from "../apps/server/src/account/vault";
import { isPrivateAddress, publicUrl } from "../apps/server/src/plugins/address";
import { type ConnectorId, popularOf, toolName } from "../apps/server/src/plugins/catalog";
import { matchingPlugins } from "../apps/server/src/plugins/tools";
import { mentionedSkills } from "../apps/server/src/skills/mentions";

const connectionRow = ["exa", null, null, await seal("{}")];
const selects: string[] = [];
mock.module("@sirathic/db", () => ({
  db: drizzle(
    async (sql) => {
      if (sql.startsWith("select")) selects.push(sql);
      return { rows: [connectionRow] };
    },
    { casing: "snake_case" },
  ),
}));
const { connectedTools, disconnect, FORGET, withUpdate } =
  await import("../apps/server/src/plugins/connections");

test.each([
  "127.0.0.1",
  "10.1.2.3",
  "172.20.0.5",
  "192.168.1.1",
  "169.254.169.254",
  "100.100.1.1",
  "0.0.0.0",
  "::1",
  "fd12::1",
  "fe80::1",
  "::ffff:10.0.0.1",
  "::ffff:7f00:1",
  "::ffff:a9fe:a9fe",
  "192.0.2.5",
])("%s is private", (address) => {
  expect(isPrivateAddress(address)).toBe(true);
});

test.each(["1.1.1.1", "104.18.32.7", "172.32.0.1", "192.0.78.22", "2606:4700::1111"])(
  "%s is public",
  (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  },
);

test.each([
  "http://mcp.example.com/mcp",
  "https://127.0.0.1/mcp",
  "https://[::1]/mcp",
  "https://[::ffff:127.0.0.1]/mcp",
  "not a url",
])("%s is refused", async (raw) => {
  await expect(publicUrl(raw)).rejects.toThrow();
});

test.each<[ConnectorId, string, string]>([
  ["notion", "notion-search", "notion_notion-search"],
  ["linear", "list.issues v2", "linear_list_issues_v2"],
  ["clickup", "x".repeat(80), `clickup_${"x".repeat(56)}`],
])("%s tool %s is named %s", (connector, name, expected) => {
  const named = toolName(connector, name);
  expect(named).toBe(expected);
  expect(named).toMatch(/^[\w-]{1,64}$/u);
});

test("popular keeps the six most connected plugins that at least three people use", () => {
  const counts = [
    { connector: "notion", users: 9 },
    { connector: "linear", users: 3 },
    { connector: "stripe", users: 2 },
    { connector: "canva", users: 9 },
    { connector: "neon", users: 5 },
    { connector: "exa", users: 4 },
    { connector: "sentry", users: 4 },
    { connector: "vercel", users: 7 },
  ];
  expect([...popularOf(counts)]).toEqual(["canva", "notion", "vercel", "neon", "exa", "sentry"]);
  expect(popularOf([{ connector: "notion", users: 2 }]).size).toBe(0);
});

const client = { client_id: "registered" };
const tokens = { access_token: "granted", token_type: "Bearer" };

test("saving tokens connects the plugin and keeps the registered client", () => {
  expect(withUpdate({ client, verifier: "pending" }, { tokens })).toEqual({
    secrets: { client, tokens, verifier: "pending" },
    connected: true,
  });
});

test("forgetting tokens disconnects the plugin but keeps the registered client", () => {
  expect(withUpdate({ client, tokens }, FORGET.tokens)).toEqual({
    secrets: { client },
    connected: false,
  });
});

test("forgetting everything leaves nothing stored", () => {
  expect(withUpdate({ client, tokens, verifier: "pending", state: "x" }, FORGET.all)).toEqual({
    secrets: {},
    connected: false,
  });
});

const skills = [{ name: "Brief" }, { name: "Deep" }, { name: "Deep Dive" }, { name: "İman" }];
const namesIn = (text: string) => mentionedSkills(text, skills).map((skill) => skill.name);

test("a skill is found anywhere in the text, in any case", () => {
  expect(namesIn("what is wudu? @brief")).toEqual(["Brief"]);
});

test("the longest name wins and names may contain spaces", () => {
  expect(namesIn("@Deep Dive on salah")).toEqual(["Deep Dive"]);
  expect(namesIn("@Deep on salah")).toEqual(["Deep"]);
});

test("several skills are found once each", () => {
  expect(namesIn("@Brief then @Deep, and @brief again")).toEqual(["Brief", "Deep"]);
});

test("emails and longer words are not skill calls", () => {
  expect(namesIn("write to me@brief.com")).toEqual([]);
  expect(namesIn("@Briefly please")).toEqual([]);
});

test("a name whose lowercase form is longer is still found", () => {
  expect(namesIn("@İman nedir?")).toEqual(["İman"]);
});

const listed = (id: string, name: string, category: string, connected: boolean) => ({
  id,
  name,
  category,
  url: "https://example.com",
  connected,
  popular: false,
});

test("a plugin search ranks by shared words, says what is installed, and never offers a custom plugin", () => {
  const found = matchingPlugins(
    [
      listed("notion", "Notion", "productivity", false),
      listed("calendly", "Calendly", "productivity", false),
      listed("googlecalendar", "Google Calendar", "productivity", true),
      listed("custom-ab12cd34", "My calendar", "custom", true),
    ],
    "calendar events meetings",
  );
  expect(found).toEqual([
    {
      id: "googlecalendar",
      name: "Google Calendar",
      does: "See your calendars and events",
      installed: true,
    },
    {
      id: "calendly",
      name: "Calendly",
      does: "Check availability and book meetings",
      installed: false,
    },
  ]);
});

const rpc = z.object({
  id: z.number().optional(),
  method: z.string(),
  params: z.object({ protocolVersion: z.string().optional() }).optional(),
});
const serverSaw: string[] = [];
const serverTools = [
  {
    name: "search",
    description: "Finds pages",
    inputSchema: { type: "object", properties: { q: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  { name: "post", description: "Posts a page", inputSchema: { type: "object", properties: {} } },
];

const resultOf = (method: string, protocolVersion: string | undefined) =>
  method === "initialize"
    ? { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "stub", version: "1" } }
    : method === "tools/list"
      ? { tools: serverTools }
      : { content: [{ type: "text", text: "found" }] };

globalThis.fetch = Object.assign(
  async (_url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.method !== "POST") return new Response(null, { status: 405 });
    const { id, method, params } = rpc.parse(JSON.parse(String(init.body)));
    serverSaw.push(method);
    if (id === undefined) return new Response(null, { status: 202 });
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: resultOf(method, params?.protocolVersion),
    });
  },
  { preconnect: () => {} },
);

test("a plugin's tools come from the saved list and its server is reached only when a tool is called", async () => {
  const first = await connectedTools("owner");
  await first.close();
  expect(serverSaw).toContain("tools/list");

  serverSaw.length = 0;
  const second = await connectedTools("owner");
  expect(serverSaw).toEqual([]);
  expect(Object.keys(second.tools)).toEqual(["exa_search", "exa_post"]);
  expect(writingTools(second.tools)).toEqual(["exa_post"]);

  const found = await second.tools.exa_search?.execute?.(
    { q: "wudu" },
    { toolCallId: "call", messages: [], context: {} },
  );
  expect(found).toMatchObject({ content: [{ type: "text", text: "found" }] });
  expect(serverSaw).toContain("initialize");
  expect(serverSaw).toContain("tools/call");
  expect(serverSaw).not.toContain("tools/list");
  await second.close();
});

test("a plugin's connection row is read once for a minute and again after a disconnect", async () => {
  selects.length = 0;
  await (await connectedTools("owner-2")).close();
  await (await connectedTools("owner-2")).close();
  expect(selects).toHaveLength(1);
  await disconnect("owner-2", "exa");
  await (await connectedTools("owner-2")).close();
  expect(selects).toHaveLength(2);
});
