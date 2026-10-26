import { expect, test } from "bun:test";
import { researchOf } from "../src/components/research";

const call = (toolName: string, args: Record<string, string>, result?: string) =>
  ({ type: "tool-call", toolCallId: toolName, toolName, args, argsText: "", result }) as const;

test("calls in a row to one plugin become one step with readable titles and their main argument", () => {
  expect(
    researchOf(
      [
        call("exa_web_search_exa", { objective: "find it", query: "ramadan 2027" }, "done"),
        call("exa_crawling_exa", { url: "https://a.org" }),
        call("custom-ab12cd34_get-message", { id: "1a17" }),
      ],
      false,
    ),
  ).toEqual([
    {
      kind: "plugin",
      plugin: "exa",
      calls: [
        { tool: "Web Search", detail: "ramadan 2027", done: true },
        { tool: "Crawling", detail: "https://a.org", done: false },
      ],
    },
    {
      kind: "plugin",
      plugin: "custom-ab12cd34",
      calls: [{ tool: "Get Message", detail: "1a17", done: false }],
    },
  ]);
});
