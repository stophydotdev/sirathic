import { dynamicTool } from "ai";
import { expect, test } from "bun:test";
import { z } from "zod";
import { publicUrl } from "@sirathic/core/web/url";
import { isPrivateUrl } from "../apps/browser/src/blocked";
import { masked } from "../apps/browser/src/mask";
import { asksFirst } from "../apps/server/src/chat/autoReview";
import { needsApproval, writingTools } from "../apps/server/src/chat/confirm";
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
  ["update_skill", { action: "delete" }, true],
  ["update_routine", { action: "delete" }, false],
])("the %s call %p needs the user's confirmation: %p", (toolName, input, expected) => {
  const writes = new Set([
    "slack_send",
    "posthog_exec",
    "neon_run_sql",
    "neon_run_sql_transaction",
    "custom_sendEmail",
    "custom_manage_mail",
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
