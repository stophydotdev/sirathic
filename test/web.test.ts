import { expect, test } from "bun:test";
import { approveAs } from "../apps/web/src/components/approvalVerb";
import { splitLinks } from "../apps/web/src/components/linkedText";
import { splitMentions } from "../apps/web/src/components/mentionText";
import {
  clockParts,
  clockText24,
  hour12Of,
  hour24Of,
} from "../apps/web/src/components/automationText";
import { rehypeBareCitations } from "../apps/web/src/components/citations";
import { botGroups } from "../packages/app/src/botGroups";
import { bubblesOf } from "../packages/app/src/botBubbles";
import { stampText } from "../apps/web/src/components/botStamp";
import { whenOf } from "../apps/web/src/components/botTime";
import { researchOf } from "../apps/web/src/components/research";
import { refreshing } from "../apps/web/src/lib/refreshing";
import { type ChatMessage, question } from "../apps/server/src/shared/messages";
import { outdated } from "../apps/web/src/components/chat";
import { importedFacts } from "../apps/web/src/components/memoryImport";
import { blobMotion } from "../packages/app/src/blob/engine";
import { BODIES, bodyOf } from "../packages/app/src/blob/shape";

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

const stepsFor = (names: [string, string]) =>
  researchOf(
    [
      { ...call(names[0], {}, "done"), args: { queries: ["wudu"] } },
      call(names[1], { url: "https://islamqa.info/en/answers/1" }, "done"),
    ],
    false,
  );

test("a chat saved with the old search and fetch tool names shows the same steps as a new one", () => {
  const old = stepsFor(["search", "webFetch"]);
  expect(old).toEqual(stepsFor(["search_web", "fetch_url"]));
  expect(old.map((step) => step.kind)).toEqual(["searches", "browse"]);
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

const bot = (
  name: string,
  extra: { pinned?: boolean; section?: string; hidden?: boolean } = {},
) => ({
  name,
  pinned: false,
  section: null,
  hidden: false,
  ...extra,
});

test("pinned bots come first, then each section, then bots with no section, and hidden ones are set aside", () => {
  const { groups, hidden } = botGroups(
    [
      bot("Zaid", { pinned: true, section: "Study" }),
      bot("Amal"),
      bot("Bilal", { section: "Study" }),
      bot("Dawud", { section: "Kids" }),
      bot("Hana", { hidden: true }),
    ],
    6,
  );
  expect(groups.map((group) => [group.kind, group.bots.map((found) => found.name)])).toEqual([
    ["pinned", ["Zaid"]],
    ["section", ["Dawud"]],
    ["section", ["Bilal"]],
    ["loose", ["Amal"]],
  ]);
  expect(hidden.map((found) => found.name)).toEqual(["Hana"]);
});

test("only the first six unpinned bots show and the rest are counted", () => {
  const bots = ["a", "b", "c", "d", "e", "f", "g", "h"].map((name) => bot(name));
  const { groups, more } = botGroups(bots, 6);
  expect(groups.flatMap((group) => group.bots.map((found) => found.name))).toEqual([
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ]);
  expect(more).toBe(2);
});

test("a fetch of several pages gives one step per page and marks the ones that failed", () => {
  const steps = researchOf(
    [
      {
        type: "tool-call",
        toolCallId: "f1",
        toolName: "fetch_url",
        args: { urls: ["https://a.org/1", "https://b.org/2"] },
        argsText: "",
        result: {
          pages: [{ url: "https://a.org/1" }, { url: "https://b.org/2", error: "no text" }],
        },
      },
    ],
    false,
  );
  expect(steps).toEqual([
    { kind: "browse", url: "https://a.org/1", failed: false },
    { kind: "browse", url: "https://b.org/2", failed: true },
  ]);
});

const localIso = (day: number, hour: number) => new Date(2026, 9, day, hour, 5).toISOString();

test("a bot's last message shows the time today, yesterday, then the date", () => {
  const now = new Date(2026, 9, 27, 15, 0);
  expect(
    [localIso(27, 9), localIso(26, 23), localIso(10, 9)].map((iso) => whenOf("en", iso, now)),
  ).toEqual(["9:05 AM", "yesterday", "10/10"]);
});

const atOctober = (day: number, hour: number, minute: number) =>
  new Date(2026, 9, day, hour, minute).getTime();

test("a chat stamp says today or yesterday with the time, and older days by date", () => {
  const now = atOctober(27, 19, 20);
  expect(
    [atOctober(27, 18, 37), atOctober(26, 23, 5), atOctober(20, 9, 0)].map((time) =>
      stampText("en", time, now).replaceAll(/\s/gu, " "),
    ),
  ).toEqual(["today 6:37 PM", "yesterday 11:05 PM", "Oct 20, 2026 9:00 AM"]);
});

test("a bot reply splits into a bubble per paragraph, but headings, lists and tables stay with the bubble they follow and code blocks stay whole", () => {
  const reply = [
    "Here is the guide.",
    "## Wudu",
    "1. Intend\n2. Wash",
    "| Breaks | Notes |\n| - | - |\n| Sleep | Deep |",
    "Source: Quran.com",
    "```\ncode\n\nmore\n```",
  ].join("\n\n");
  expect(bubblesOf(reply)).toEqual([
    "Here is the guide.\n\n## Wudu\n\n1. Intend\n2. Wash\n\n| Breaks | Notes |\n| - | - |\n| Sleep | Deep |",
    "Source: Quran.com",
    "```\ncode\n\nmore\n```",
  ]);
});

test("components that ask together share one request and a list refreshed after a write is never replaced by an older answer", async () => {
  const requests = [
    Promise.withResolvers<string>(),
    Promise.withResolvers<string>(),
    Promise.withResolvers<string>(),
  ];
  let asked = 0;
  const shown: string[] = [];
  const list = refreshing(
    async () => requests[asked++]?.promise,
    (value) => void shown.push(value),
  );

  const first = Promise.all([list.join(), list.join()]);
  expect(asked).toBe(1);

  const afterWrite = list.fresh();
  expect(asked).toBe(2);
  requests[1]?.resolve("after the write");
  await afterWrite;
  requests[0]?.resolve("before the write");
  await first;
  expect(shown).toEqual(["after the write"]);

  void list.join();
  expect(asked).toBe(3);
});

type Tree = Parameters<ReturnType<typeof rehypeBareCitations>>[0];

const sentence = (start: string): Tree => {
  const url = "https://example.com/a";
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [
          { type: "text", value: start },
          {
            type: "element",
            tagName: "a",
            properties: { href: url, dataUrls: [url] },
            children: [],
          },
          { type: "text", value: ". It is not shared by all." },
        ],
      },
    ],
  };
};

test("a hidden citation takes the space before it, so the period stays against the word", () => {
  const tree = sentence("That is the Hanafi view ");
  rehypeBareCitations()(tree);
  expect(tree).toEqual(sentence("That is the Hanafi view"));
});

test("a bot's chosen shape wins, an old icon name falls back to the shape its id picks", () => {
  expect(bodyOf("drop", "4b1f")).toBe(BODIES.drop);
  expect(bodyOf("star", "4b1f")).toBe(bodyOf(null, "4b1f"));
  expect(Object.values(BODIES)).toContain(bodyOf(null, "4b1f"));
});

test("the shine hides while the bot thinks and comes back after the done burst", () => {
  const motion = blobMotion(BODIES.circle, "ready");
  motion.set("thinking", 0);
  expect(motion.frame(1).shine).toBeNull();
  motion.set("done", 1);
  expect(motion.frame(1.5).shine).toBeNull();
  expect(motion.still(2)).toBe(false);
  motion.frame(3.5);
  expect(motion.frame(4.5).shine?.opacity).toBe(0.85);
  expect(motion.still(4.5)).toBe(true);
});

test("imported memory drops bullets, blanks and repeats, and stops at the 20 facts kept", () => {
  const pasted = "- Lives in Leeds\n\n2. Teaches Arabic\n• lives in leeds\n* Is a revert";
  expect(importedFacts(pasted, ["Is a revert"])).toEqual(["Lives in Leeds", "Teaches Arabic"]);
  expect(
    importedFacts(
      pasted,
      Array.from({ length: 19 }, (_, i) => `Fact ${i}`),
    ),
  ).toEqual(["Lives in Leeds"]);
});

test.each([
  ["neon_run_sql", { sql: "DROP TABLE test_users" }, "Delete", true],
  ["update_skill", { action: "delete", name: "Brief" }, "Delete", true],
  ["stripe_createRefund", { order: "1042" }, "Refund", true],
  ["stripe_pay_invoice", { id: "in_1" }, "Pay", true],
  ["slack_post_message", { text: "hi" }, "Post", false],
  ["todoist_update_task", { id: "1" }, "Confirm", false],
])("%s asks to %s, and wipe-outs and payments are red", (toolName, args, label, danger) => {
  expect(approveAs({ toolName, args })).toMatchObject({ label, danger });
});

test("a question card saved before multi-pick still opens as a single pick", () => {
  expect(
    question.safeParse({ question: "Which school?", options: ["Hanafi", "Maliki"] }).data,
  ).toEqual({
    question: "Which school?",
    options: ["Hanafi", "Maliki"],
  });
});

const turn = (id: string, role: ChatMessage["role"], text: string) =>
  ({ id, role, parts: [{ type: "text", text }] }) satisfies ChatMessage;

test("a chat kept from this tab is redrawn only when the server has more of it", () => {
  const asked = turn("q", "user", "What breaks wudu?");
  const kept = [asked, turn("a", "assistant", "Sleep and")];
  expect([
    outdated(kept, kept),
    outdated(kept, [asked, turn("a", "assistant", "Sleep and wind break it.")]),
    outdated(kept, [...kept, turn("q2", "user", "And blood?")]),
  ]).toEqual([false, true, true]);
});
