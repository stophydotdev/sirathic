import { expect, mock, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import { z } from "zod";
import { writingTools } from "../apps/server/src/chat/confirm";
import { seal } from "../apps/server/src/account/vault";
import { isPrivateAddress, publicUrl } from "../apps/server/src/plugins/address";
import { type ConnectorId, popularOf, toolName } from "../apps/server/src/plugins/catalog";
import { emailEditKey } from "../apps/server/src/plugins/outgoingEmail";
import { mentionedSkills } from "../apps/server/src/skills/mentions";

const connectionRow = ["exa", null, null, await seal("{}")];
const savedLists = new Map<string, string>();
mock.module("@sirathic/core/cache", () => ({
  cacheFor:
    <Value>({ namespace, schema }: { namespace: string; schema: z.ZodType<Value> }) =>
    async (id: string, fetchValue: () => Promise<Value>) => {
      const key = `${namespace}:${id}`;
      const kept = savedLists.get(key);
      if (kept !== undefined) return schema.parse(JSON.parse(kept));
      const value = await fetchValue();
      savedLists.set(key, JSON.stringify(value));
      return value;
    },
  dropCached: async (namespace: string, id: string) => void savedLists.delete(`${namespace}:${id}`),
  keepFor: async (key: string, value: string) => void savedLists.set(key, value),
  readKept: async (key: string) => savedLists.get(key) ?? null,
  dropKept: async (key: string) => void savedLists.delete(key),
}));
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
const { connectedTools, disconnect, emailToSend, listConnections, FORGET, mimeOf, withUpdate } =
  await import("../apps/server/src/plugins/connections");
const { keepFor } = await import("@sirathic/core/cache");
const { matchingPlugins, notConnected } = await import("../apps/server/src/plugins/tools");

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

test("an email to send keeps an Arabic subject and body intact", () => {
  const mime = mimeOf({
    to: ["a@example.com"],
    cc: ["b@example.com"],
    subject: "جزاك الله خيرا",
    body: "Assalamu alaikum\nبارك الله فيك",
  });
  const [headers = "", body = ""] = mime.split("\r\n\r\n");
  const subject = /Subject: =\?UTF-8\?B\?(.+)\?=/u.exec(headers)?.[1] ?? "";
  expect(headers).toContain("To: a@example.com\r\nCc: b@example.com");
  expect(Buffer.from(subject, "base64").toString()).toBe("جزاك الله خيرا");
  expect(Buffer.from(body, "base64").toString()).toBe("Assalamu alaikum\nبارك الله فيك");
});

test("an edited email goes out for the person who edited it and that call, and only them", async () => {
  const asked = { to: ["jane@example.com"], subject: "Iftar", body: "Friday at 7" };
  const edited = { ...asked, to: ["omar@example.com"], body: "Friday at 8" };
  await keepFor(emailEditKey("ali", "call1"), JSON.stringify(edited), 600);
  expect(await emailToSend("sara", "call1", asked)).toEqual(asked);
  expect(await emailToSend("ali", "call2", asked)).toEqual(asked);
  expect(await emailToSend("ali", "call1", asked)).toEqual(edited);
  expect(await emailToSend("ali", "call1", asked)).toEqual(edited);
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
let callsFail = false;
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
    if (callsFail && method === "tools/call") {
      return Response.json({ jsonrpc: "2.0", id, error: { code: -32000, message: "gone" } });
    }
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

test("a failed tool call drops the saved list and the next answer lists the tools again", async () => {
  const call = { toolCallId: "call", messages: [], context: {} };
  await (await connectedTools("owner-3")).close();
  serverSaw.length = 0;

  const failing = await connectedTools("owner-3");
  callsFail = true;
  await expect(failing.tools.exa_search?.execute?.({ q: "wudu" }, call)).rejects.toThrow("gone");
  callsFail = false;
  await failing.close();
  expect(serverSaw).not.toContain("tools/list");

  serverSaw.length = 0;
  await (await connectedTools("owner-3")).close();
  expect(serverSaw).toContain("tools/list");
});

test("the plugin list is read once for a minute and again after a disconnect", async () => {
  selects.length = 0;
  await listConnections("owner-4");
  await listConnections("owner-4");
  expect(selects).toHaveLength(2);
  await disconnect("owner-4", "exa");
  await listConnections("owner-4");
  expect(selects).toHaveLength(4);
});

test("a failed install tells the model the real reason, without URLs or secrets, and no promise to retry", () => {
  const err = new Error(
    "Gmail sign-in failed: invalid_grant from https://oauth2.example.com/token?code=abc with client_secret=s3cr3t for this app.",
  );
  expect(notConnected(err)).toBe(
    "Not connected: Gmail sign-in failed: invalid_grant from with for this app. Tell the user it did not connect and why, in plain words. Do not say whose side failed or promise to retry.",
  );
});
