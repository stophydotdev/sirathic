import { expect, test } from "bun:test";
import { splitLinks } from "../apps/web/src/components/linkedText";
import { splitMentions } from "../apps/web/src/components/mentionText";
import {
  clockParts,
  clockText24,
  hour12Of,
  hour24Of,
} from "../apps/web/src/components/automationText";
import { researchOf } from "../apps/web/src/components/research";

test("a link keeps its path and drops the trailing period and question mark", () => {
  expect(splitLinks("What does https://a.org/x/y say? Also see https://b.info/en/82536.")).toEqual([
    { kind: "text", value: "What does " },
    { kind: "link", value: "https://a.org/x/y" },
    { kind: "text", value: " say? Also see " },
    { kind: "link", value: "https://b.info/en/82536" },
    { kind: "text", value: "." },
  ]);
});

test("a link in brackets or quotes loses the closing mark", () => {
  expect(splitLinks('(http://a.org/p), "https://b.org"').map((p) => p.value)).toEqual([
    "(",
    "http://a.org/p",
    '), "',
    "https://b.org",
    '"',
  ]);
});

test("text without a link comes back as one part", () => {
  expect(splitLinks("no links\nhere")).toEqual([{ kind: "text", value: "no links\nhere" }]);
});

const targets = [{ name: "Exa" }, { name: "My Skill" }, { name: "My" }];

test("known names after @ become mentions, longest first, as typed", () => {
  expect(splitMentions("ask @my skill and @Exa.", targets)).toEqual([
    { kind: "text", value: "ask " },
    { kind: "mention", value: "@my skill", target: { name: "My Skill" } },
    { kind: "text", value: " and " },
    { kind: "mention", value: "@Exa", target: { name: "Exa" } },
    { kind: "text", value: "." },
  ]);
});

test("emails, longer words and unknown names stay text", () => {
  expect(splitMentions("me@Exa.com @Exam @Other", targets)).toEqual([
    { kind: "text", value: "me@Exa.com @Exam @Other" },
  ]);
});

test("names with a Turkish İ still match, also after one", () => {
  expect(splitMentions("İ @İman", [{ name: "İman" }])).toEqual([
    { kind: "text", value: "İ " },
    { kind: "mention", value: "@İman", target: { name: "İman" } },
  ]);
});

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

test("the 12 hour clock maps midnight and noon to 12 and back to 24 hour time", () => {
  const cases = [
    { hour: 0, twelve: 12, pm: false },
    { hour: 9, twelve: 9, pm: false },
    { hour: 12, twelve: 12, pm: true },
    { hour: 19, twelve: 7, pm: true },
  ];
  for (const { hour, twelve, pm } of cases) {
    expect(hour12Of(hour)).toBe(twelve);
    expect(hour24Of(twelve, pm)).toBe(hour);
  }
});

test("a time keeps its hour and minute through the picker's parts", () => {
  const { hour, minute } = clockParts("07:05");
  expect({ hour, minute }).toEqual({ hour: 7, minute: 5 });
  expect(clockText24(hour, minute)).toBe("07:05");
});
