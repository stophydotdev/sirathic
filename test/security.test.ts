import { dynamicTool, type UIMessage } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import { publicUrl } from "@sirathic/core/web/url";
import { isPrivateUrl } from "../apps/browser/src/blocked";
import { masked } from "../apps/browser/src/mask";
import { addressesIn, approvalFor, asksFirst, needsCard } from "../apps/server/src/chat/autoReview";
import {
  needsApproval,
  sendOnceAfterApproval,
  withDeclineReasons,
  writingTools,
} from "../apps/server/src/chat/confirm";
import type { ChatMessage } from "../apps/server/src/shared/messages";
import { screenTicket, ticketFits } from "../apps/server/src/bots/screenTicket";
import { totp } from "../apps/server/src/vault/totp";

test.each([
  ["slack_send", {}, true],
  ["custom_sendEmail", { to: "a@b.c" }, true],
  ["custom_manage_mail", { action: "send", to: "a@b.c" }, true],
  ["neon_run_sql", { sql: "DROP TABLE users" }, true],
  ["neon_run_sql", { sql: "select count(*) from users" }, false],
  ["neon_run_sql_transaction", { sql_statements: ["select 1", "DELETE FROM users"] }, true],
  ["posthog_exec", { command: 'call query-run {"event":"post_created"}' }, false],
  ["posthog_exec", { command: `${" ".repeat(90)}call project-destroy {"id":7}` }, true],
  ["cal_delete_event", { eventId: "ev1" }, true],
  ["update_skill", { action: "delete" }, true],
  ["update_routine", { action: "delete" }, true],
  ["update_routine", { action: "create" }, true],
  ["update_routine", { action: "pause" }, false],
])("the %s call %p needs the user's confirmation: %p", (toolName, input, expected) => {
  const writes = new Set([
    "slack_send",
    "posthog_exec",
    "neon_run_sql",
    "neon_run_sql_transaction",
    "custom_sendEmail",
    "custom_manage_mail",
    "cal_delete_event",
  ]);
  expect(needsApproval({ toolName, input }, writes)).toBe(expected);
});

const allow = { text: "reply to emails for me", effect: "allow" } as const;
const ask = { text: "email my boss", effect: "ask" } as const;

const scoredBy = async <T>(scores: number[] | undefined, run: () => Promise<T>) => {
  const real = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async () =>
      scores
        ? Response.json({
            result: {
              answers: Object.fromEntries(scores.map((noul, i) => [`rule${i}`, { noul }])),
            },
          })
        : new Response("down", { status: 500 }),
    { preconnect: real.preconnect },
  );
  try {
    return await run();
  } finally {
    globalThis.fetch = real;
  }
};

test.each([
  ["a matching allow rule skips the card", "gmail_send_email", [allow], [0.9], false],
  ["a weak match still asks", "gmail_send_email", [allow], [0.5], true],
  ["an ask rule beats an allow rule", "gmail_send_email", [allow, ask], [0.9, 0.4], true],
  ["pay always asks", "stripe_create_payout", [allow], [1], true],
  ["a failed check asks", "gmail_send_email", [allow], undefined, true],
])("%s", async (_, toolName, rules, scores, expected) => {
  const asks = await scoredBy(scores, () => asksFirst({ toolName, input: {} }, rules));
  expect(asks).toBe(expected);
});

test("a bulk action asks even when an allow rule matches it", async () => {
  const input = {
    search: { tool: "gmail_search_threads" },
    rule: "marketing emails",
    action: { tool: "gmail_trash_thread", idArgument: "threadId" },
  };
  const asks = await scoredBy([0.9], () => asksFirst({ toolName: "bulk_action", input }, [allow]));
  expect(asks).toBe(true);
});

const calendar = { text: "ask me before changing my calendar", effect: "ask" } as const;
const changes = new Set([
  "cal_create_event",
  "gmail_trash_thread",
  "gmail_create_draft",
  "gmail_update_message_labels",
]);

test.each([
  ["no rule leaves a calendar change alone", "cal_create_event", [], undefined, false],
  ["an allow rule does not ask for a mail change", "gmail_trash_thread", [allow], [1], false],
  [
    "an ask rule that matches puts a card on a calendar change",
    "cal_create_event",
    [calendar],
    [0.9],
    true,
  ],
  ["an ask rule that does not match leaves it alone", "cal_create_event", [calendar], [0.1], false],
  ["a failed check asks when a rule asks", "gmail_trash_thread", [calendar], undefined, true],
  [
    "an ask rule that matches puts a card on a label update",
    "gmail_update_message_labels",
    [calendar],
    [0.9],
    true,
  ],
  ["a rule the check leaves unscored asks", "cal_create_event", [calendar], [], true],
  ["a draft is not a change to their mailbox", "gmail_create_draft", [calendar], [1], false],
])("%s", async (_, toolName, rules, scores, expected) => {
  const asks = await scoredBy(scores, () => needsCard({ toolName, input: {} }, changes, rules));
  expect(asks).toBe(expected);
});

const card = (approved: boolean): ChatMessage => ({
  id: `m-${approved}`,
  role: "assistant",
  parts: [
    {
      type: "dynamic-tool",
      toolName: "cal_create_event",
      toolCallId: "c",
      state: "approval-responded",
      input: {},
      approval: { id: "a", approved },
    },
  ],
});

test("a declined card tells the model the user declined and an approved one adds nothing", () => {
  const reasons = [false, true].flatMap((approved) =>
    withDeclineReasons([card(approved)]).flatMap(({ parts }) =>
      parts.map((part) => (part.type === "dynamic-tool" ? part.approval?.reason : undefined)),
    ),
  );
  expect(reasons[0]).toContain("The user declined this action");
  expect(reasons[1]).toBeUndefined();
});

test.each([
  ["gmail_send_email", { to: ["boss@work.example"], subject: "Report", body: "Done" }, true],
  ["gmail_send_email", { to: ["Me@Home.example"], subject: "Summary", body: "Hi" }, true],
  ["gmail_send_email", { to: ["ss@work.example"], subject: "Report", body: "Done" }, false],
  [
    "gmail_send_email",
    { to: ["boss@work.example"], bcc: ["thief@evil.example"], subject: "Report", body: "Done" },
    false,
  ],
  ["slack_send", { channel: "general", text: "hi" }, false],
  ["cal_delete_event", { eventId: "ev1" }, false],
  ["gmail_create_draft", { to: ["thief@evil.example"], body: "hi" }, true],
  ["gmail_update_message_labels", { removeLabelIds: ["INBOX"] }, true],
  ["cal_create_event", { title: "Fajr" }, true],
  ["github_merge_pull_request", { pull_number: 7 }, false],
  ["stripe_create_payment_link", { price: "p1" }, false],
  ["gmail_delete_draft", { id: "d1" }, false],
  ["github_merge_pull_request", { pull_number: 7, action: "label" }, false],
  ["stripe_create_payment_link", { command: "create draft" }, false],
])("a routine run's %s call %p goes ahead: %p", async (toolName, input, allowed) => {
  const writes = new Set([
    "gmail_send_email",
    "gmail_create_draft",
    "gmail_delete_draft",
    "gmail_update_message_labels",
    "slack_send",
    "cal_create_event",
    "cal_delete_event",
    "github_merge_pull_request",
    "stripe_create_payment_link",
  ]);
  const saved = "Every Friday email my weekly report to boss@work.example.";
  const status = await approvalFor(
    { toolName, input },
    writes,
    [],
    [...addressesIn(saved), "me@home.example"],
  );
  expect(status === undefined).toBe(allowed);
});

test("an address in a routine written without spaces is found on its own", () => {
  expect(addressesIn("毎週金曜日にboss@work.exampleへ週報を送って")).toEqual(["boss@work.example"]);
});

const answered = (id: string): UIMessage[] => [
  {
    id: "a",
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "update_skill",
        toolCallId: `call-${id}`,
        state: "approval-responded",
        input: {},
        approval: { id, approved: true },
      },
    ],
  },
];

test("an approval answer goes to the server once, even when the follow-up is cut short", () => {
  const shouldSend = sendOnceAfterApproval();
  expect(
    [answered("1"), answered("1"), answered("2")].map((messages) => shouldSend({ messages })),
  ).toEqual([true, false, true]);
});

test("a plugin tool needs confirmation unless the plugin marks it read-only", () => {
  const lookup = dynamicTool({
    inputSchema: z.object({}),
    metadata: { annotations: { readOnlyHint: true } },
    execute: async () => "found",
  });
  const send = dynamicTool({ inputSchema: z.object({}), execute: async () => "sent" });
  expect(writingTools({ slack_find: lookup, slack_send: send })).toEqual(["slack_send"]);
});

const readable = (url: string) => publicUrl.safeParse(url).success;

test("only public http and https pages can be read", () => {
  expect(readable("https://islamqa.info/en/answers/1")).toBe(true);
  expect(
    [
      "file:///etc/passwd",
      "http://localhost:3000/",
      "http://2130706433/",
      "http://10.0.0.5/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://metadata.google.internal/",
    ].map(readable),
  ).toEqual(Array(7).fill(false));
});

test("pages can't take a bot's browser to private or internal hosts", () => {
  const blocked = [
    "http://127.0.0.1:8080/health",
    "http://localhost:3000/",
    "http://api.railway.internal:3000/",
    "http://10.1.2.3/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://intranet/",
  ];
  expect(blocked.filter((url) => !isPrivateUrl(url))).toEqual([]);
  expect(isPrivateUrl("https://the-internet.herokuapp.com/login")).toBe(false);
});

test("two-step codes match the RFC 6238 test vector", () => {
  expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1_111_111_109_000)).toBe("081804");
});

test("a secret is masked in every spelling a page can show it, and nothing else changes", () => {
  const shown = masked(
    'a ?q=p%40ss%20w%22rd%21 b ?q=p%40ss+w%22rd! c {"v":"p@ss w\\"rd!"} d ?q=prayer%26mat',
    ['p@ss w"rd!'],
  );
  expect(shown).toBe('a ?q=•••••• b ?q=•••••• c {"v":"••••••"} d ?q=prayer%26mat');
});

test("a screen ticket opens only its own bot's screen, and only for a minute", () => {
  const bot = "8bc4443d-047a-49e6-b335-9cf3fa71d658";
  const ticket = screenTicket(bot, 1_000);
  expect(ticketFits(ticket, bot, 2_000)).toBe(true);
  expect(ticketFits(ticket, "53f15e17-feea-458d-80b0-0f767c35455b", 2_000)).toBe(false);
  expect(ticketFits(ticket, bot, 62_000)).toBe(false);
  expect(
    ticketFits(
      ticket.replace(/.$/u, (last) => (last === "A" ? "B" : "A")),
      bot,
      2_000,
    ),
  ).toBe(false);
  expect(ticketFits(`${bot}.999999999999999.forged`, bot, 2_000)).toBe(false);
});
