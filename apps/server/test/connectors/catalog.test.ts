import { expect, test } from "bun:test";
import { type ConnectorId, popularOf, toolName } from "../../src/connectors/catalog";

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
