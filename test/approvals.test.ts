import { dynamicTool } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import type { ChatMessage } from "../apps/server/src/shared/messages";
import { asksFirst } from "../apps/server/src/chat/autoReview";
import { cardDecisions, needsApproval, writingTools } from "../apps/server/src/chat/confirm";
import { said } from "./answerHelpers";

test.each([
  ["update_routine", { action: "create" }, false],
  ["update_routine", { action: "edit" }, false],
  ["update_routine", { action: "delete" }, false],
  ["update_routine", { action: "pause" }, false],
  ["update_skill", { action: "delete" }, true],
  ["install_plugin", { id: "googlecalendar" }, false],
  ["search_plugins", { query: "calendar" }, false],
  ["update_skill", { action: "write" }, false],
  ["update_routine", { action: "resume" }, false],
  ["list_routines", {}, false],
  ["slack_send", {}, true],
  ["todoist_add_tasks", { content: "Read Surah Al-Mulk" }, false],
  ["posthog_exec", { command: "call project-get {}" }, false],
  ["posthog_exec", { command: 'call feature-flag-delete {"id":7}' }, false],
  ["googlecalendar_delete_event", { eventId: "e1" }, false],
  ["neon_run_sql", { sql: "select count(*) from users" }, false],
  ["neon_run_sql", { sql: "DROP TABLE users" }, true],
  ["posthog_exec", { command: 'call query-run {"event":"post_created"}' }, false],
  ["posthog_exec", { command: 'call funnel-get {"steps":["signup","drop_off"]}' }, false],
  ["neon_run_sql_transaction", { sql_statements: ["select 1", "DELETE FROM users"] }, true],
  ["custom_sendEmail", { to: "a@b.c" }, true],
  ["custom_manage_mail", { action: "send", to: "a@b.c" }, true],
  ["custom_manage_files", { action: "delete", id: "file-1" }, false],
  ["custom_manage_files", { action: "rename", id: "file-1" }, false],
  ["posthog_exec", { command: `${" ".repeat(90)}call project-destroy {"id":7}` }, true],
])("the %s call %p needs the user's confirmation: %p", (toolName, input, expected) => {
  const writes = new Set([
    "slack_send",
    "todoist_add_tasks",
    "posthog_exec",
    "neon_run_sql",
    "neon_run_sql_transaction",
    "custom_sendEmail",
    "custom_manage_mail",
    "custom_manage_files",
    "googlecalendar_delete_event",
  ]);
  expect(needsApproval({ toolName, input }, writes)).toBe(expected);
});

const allow = { text: "reply to emails for me", effect: "allow" } as const;
const ask = { text: "email my boss", effect: "ask" } as const;

test.each([
  ["a matching allow rule skips the card", "gmail_send_email", [allow], [0.9], false],
  ["a weak match still asks", "gmail_send_email", [allow], [0.5], true],
  ["an ask rule beats an allow rule", "gmail_send_email", [allow, ask], [0.9, 0.4], true],
  ["pay always asks", "stripe_create_payout", [allow], [1], true],
  ["so does sending money", "custom_send_money", [allow], [1], true],
  ["no allow rule asks", "gmail_send_email", [ask], [0], true],
  ["a failed check asks", "gmail_send_email", [allow], undefined, true],
])("%s", async (_, toolName, rules, scores, expected) => {
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
  const asks = await asksFirst({ toolName, input: {} }, rules);
  globalThis.fetch = real;
  expect(asks).toBe(expected);
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

const card = (state: "approval-requested" | "approval-responded"): ChatMessage => ({
  id: "2",
  role: "assistant",
  metadata: { createdAt: Date.now() - 30_000 },
  parts: [
    state === "approval-responded"
      ? {
          type: "dynamic-tool",
          toolName: "gmail_send_email",
          toolCallId: "c1",
          state,
          input: {},
          approval: { id: "a1", approved: true },
        }
      : {
          type: "dynamic-tool",
          toolName: "gmail_send_email",
          toolCallId: "c1",
          state,
          input: {},
          approval: { id: "a1" },
        },
  ],
});

test("a card counts once: answered on its own turn, ignored when the next message skips it", () => {
  const asked = said("1", "user", "email Jane yes");
  expect(cardDecisions([asked, card("approval-responded")])).toEqual([
    {
      name: "card.decided",
      props: { tool: "gmail_send_email", kind: "send", decision: "approved", seconds: 30 },
    },
  ]);
  const skipped = [asked, card("approval-requested"), said("3", "user", "never mind")];
  expect(cardDecisions(skipped).map((event) => event.props)).toEqual([
    { tool: "gmail_send_email", kind: "send", decision: "ignored" },
  ]);
  expect(
    cardDecisions([...skipped, said("4", "assistant", "ok"), said("5", "user", "hi")]),
  ).toEqual([]);
});
