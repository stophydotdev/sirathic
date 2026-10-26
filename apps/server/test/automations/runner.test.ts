import { expect, mock, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";

const automationId = "11111111-1111-4111-8111-111111111111";
const dueAt = "2026-10-26T09:00:00.000Z";

type StoredAutomation = { nextRunAt: string | null; enabled: boolean; lastRunAt: string | null };

const automationRow: StoredAutomation = {
  nextRunAt: dueAt,
  enabled: true,
  lastRunAt: null,
};
const savedChats: unknown[][] = [];

const fakeDb = drizzle(
  async (sql, params) => {
    if (sql.startsWith('select "id", "owner"')) {
      return {
        rows: automationRow.enabled
          ? [
              [
                automationId,
                "user-a",
                null,
                "Eid reminder",
                "Remind me of the Eid sunnahs",
                { kind: "once", date: "2026-10-26", time: "09:00" },
                "UTC",
                true,
                automationRow.nextRunAt,
                null,
                dueAt,
                dueAt,
                null,
                "research",
              ],
            ]
          : [],
      };
    }
    if (sql.startsWith('update "automations" set "enabled"')) {
      const [enabled, nextRunAt] = params;
      Object.assign(automationRow, { enabled, nextRunAt });
      return { rows: [[automationId]] };
    }
    if (sql.startsWith('update "automations" set "last_run_at"')) {
      automationRow.lastRunAt = String(params[0]);
      return { rows: [] };
    }
    if (sql.startsWith('select "id", "email"')) {
      return { rows: [["user-a", "a@example.com", null, null, null]] };
    }
    if (sql.startsWith('insert into "chat_sessions"')) {
      savedChats.push(params);
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  },
  { casing: "snake_case" },
);

mock.module("@sirathic/db", () => ({ db: fakeDb }));
const cache = await import("@sirathic/core/cache");
mock.module("@sirathic/core/cache", () => ({ ...cache, countUp: async () => 31 }));

const { runDue } = await import("../../src/automations/runner");

test("a run that fails still saves an unread chat with the reason and ends the one-time automation", async () => {
  const logged = console.error;
  console.error = () => {};
  await runDue();
  console.error = logged;

  expect(automationRow.enabled).toBe(false);
  expect(automationRow.nextRunAt).toBeNull();
  expect(automationRow.lastRunAt).not.toBeNull();
  expect(savedChats).toHaveLength(1);
  const [, owner, title, messages, unread, , savedFor] = savedChats[0];
  expect([owner, title, unread, savedFor]).toEqual(["user-a", "Eid reminder", true, automationId]);
  expect(
    JSON.parse(String(messages)).map(
      (message: { role: string; metadata: { mode: string }; parts: { text: string }[] }) => [
        message.role,
        message.metadata.mode,
        message.parts[0].text,
      ],
    ),
  ).toEqual([
    ["user", "research", "Remind me of the Eid sunnahs"],
    [
      "assistant",
      "research",
      "This run did not finish. You've used today's 30 Noor answers. They come back tomorrow.",
    ],
  ]);
});
