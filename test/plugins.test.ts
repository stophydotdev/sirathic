import { expect, test } from "bun:test";
import { isPrivateAddress, publicUrl } from "../apps/server/src/connectors/address";
import { type ConnectorId, popularOf, toolName } from "../apps/server/src/connectors/catalog";
import { FORGET, withUpdate } from "../apps/server/src/connectors/connections";
import { mentionedSkills } from "../apps/server/src/skillMentions";

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
