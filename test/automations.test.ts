import { expect, mock, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import {
  nextRun,
  schedule,
  type Schedule,
  timezone,
} from "../apps/server/src/automations/schedule";

const automationId = "11111111-1111-4111-8111-111111111111";
const dueAt = "2026-10-26T09:00:00.000Z";

type StoredAutomation = { nextRunAt: string | null; enabled: boolean; lastRunAt: string | null };

const automationRow: StoredAutomation = {
  nextRunAt: dueAt,
  enabled: true,
  lastRunAt: null,
};
const savedChats: unknown[][] = [];
const insertedAutomations: unknown[][] = [];

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
                "app",
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
    if (sql.startsWith("select count(*)")) return { rows: [[0]] };
    if (sql.startsWith('insert into "automations"')) {
      insertedAutomations.push(params);
      const [owner, name, prompt, plan, zone, nextRunAt] = params;
      return {
        rows: [
          [
            automationId,
            owner,
            null,
            name,
            prompt,
            plan,
            zone,
            true,
            nextRunAt,
            null,
            dueAt,
            dueAt,
            null,
            "quick",
            "app",
          ],
        ],
      };
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

const { runDue } = await import("../apps/server/src/automations/runner");
const { automationTools } = await import("../apps/server/src/chat/automationTools");

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

const next = (plan: Schedule, zone: string, after: string) =>
  nextRun(plan, zone, new Date(after))?.toISOString();

test("daily fires today when the time is still ahead, tomorrow when it has passed", () => {
  const plan: Schedule = { kind: "daily", time: "09:00" };
  expect(next(plan, "America/New_York", "2026-10-26T12:00:00Z")).toBe("2026-10-26T13:00:00.000Z");
  expect(next(plan, "America/New_York", "2026-10-26T14:00:00Z")).toBe("2026-10-27T13:00:00.000Z");
});

test("the same wall-clock time moves in UTC when daylight saving ends", () => {
  const plan: Schedule = { kind: "daily", time: "09:00" };
  expect(next(plan, "America/New_York", "2026-10-31T13:30:00Z")).toBe("2026-11-01T14:00:00.000Z");
});

test("a time skipped by the spring clock change fires right after the jump", () => {
  const plan: Schedule = { kind: "daily", time: "02:30" };
  expect(next(plan, "America/New_York", "2026-03-08T00:00:00Z")).toBe("2026-03-08T07:30:00.000Z");
});

test("a skipped time east of UTC fires after the jump, never before it", () => {
  const berlin: Schedule = { kind: "daily", time: "02:30" };
  expect(next(berlin, "Europe/Berlin", "2027-03-28T00:00:00Z")).toBe("2027-03-28T01:30:00.000Z");
  const cairo: Schedule = { kind: "daily", time: "00:15" };
  expect(next(cairo, "Africa/Cairo", "2027-04-28T22:15:00Z")).toBe("2027-04-29T22:15:00.000Z");
  expect(next(cairo, "Africa/Cairo", "2027-04-29T22:15:00Z")).toBe("2027-04-30T21:15:00.000Z");
});

test("a time that happens twice in autumn fires once, the first time", () => {
  const plan: Schedule = { kind: "daily", time: "01:30" };
  expect(next(plan, "America/New_York", "2026-11-01T00:00:00Z")).toBe("2026-11-01T05:30:00.000Z");
  expect(next(plan, "America/New_York", "2026-11-01T05:30:00Z")).toBe("2026-11-02T06:30:00.000Z");
});

test("zones with half-hour offsets and the date line are respected", () => {
  const plan: Schedule = { kind: "daily", time: "09:00" };
  expect(next(plan, "Asia/Kolkata", "2026-10-26T00:00:00Z")).toBe("2026-10-26T03:30:00.000Z");
  expect(next(plan, "Pacific/Kiritimati", "2026-10-26T00:00:00Z")).toBe("2026-10-26T19:00:00.000Z");
});

test("weekly picks the next chosen weekday in the person's zone", () => {
  const plan: Schedule = { kind: "weekly", days: [1, 3], time: "09:00" };
  expect(next(plan, "Asia/Tokyo", "2026-10-30T00:00:00Z")).toBe("2026-11-02T00:00:00.000Z");
  expect(next(plan, "Asia/Tokyo", "2026-11-02T00:00:00Z")).toBe("2026-11-04T00:00:00.000Z");
});

test("monthly on the 31st fires on the last day of shorter months", () => {
  const plan: Schedule = { kind: "monthly", day: 31, time: "09:00" };
  expect(next(plan, "UTC", "2027-02-01T00:00:00Z")).toBe("2027-02-28T09:00:00.000Z");
  expect(next(plan, "UTC", "2028-02-01T00:00:00Z")).toBe("2028-02-29T09:00:00.000Z");
  expect(next(plan, "UTC", "2026-04-30T09:00:00Z")).toBe("2026-05-31T09:00:00.000Z");
});

test("hourly fires on the start minute through the end time, then waits for tomorrow", () => {
  const plan: Schedule = { kind: "hourly", from: "09:30", to: "12:00" };
  expect(next(plan, "UTC", "2026-10-26T08:00:00Z")).toBe("2026-10-26T09:30:00.000Z");
  expect(next(plan, "UTC", "2026-10-26T09:30:00Z")).toBe("2026-10-26T10:30:00.000Z");
  expect(next(plan, "UTC", "2026-10-26T11:30:00Z")).toBe("2026-10-27T09:30:00.000Z");
  const exact: Schedule = { kind: "hourly", from: "09:00", to: "12:00" };
  expect(next(exact, "UTC", "2026-10-26T11:00:00Z")).toBe("2026-10-26T12:00:00.000Z");
  expect(next(exact, "UTC", "2026-10-26T12:00:00Z")).toBe("2026-10-27T09:00:00.000Z");
});

test("an hourly window across the spring clock change fires once for the skipped hour", () => {
  const plan: Schedule = { kind: "hourly", from: "01:00", to: "04:00" };
  const zone = "America/New_York";
  expect(next(plan, zone, "2026-03-08T06:00:00Z")).toBe("2026-03-08T07:00:00.000Z");
  expect(next(plan, zone, "2026-03-08T07:00:00Z")).toBe("2026-03-08T08:00:00.000Z");
  expect(next(plan, zone, "2026-03-08T08:00:00Z")).toBe("2026-03-09T05:00:00.000Z");
});

test("yearly fires on its date, and next year when this year's date has passed", () => {
  const plan: Schedule = { kind: "yearly", month: 3, day: 15, time: "08:00" };
  expect(next(plan, "UTC", "2026-01-01T00:00:00Z")).toBe("2026-03-15T08:00:00.000Z");
  expect(next(plan, "UTC", "2026-10-26T00:00:00Z")).toBe("2027-03-15T08:00:00.000Z");
});

test("yearly on Feb 29 fires on Feb 28 in years without one", () => {
  const plan: Schedule = { kind: "yearly", month: 2, day: 29, time: "08:00" };
  expect(next(plan, "UTC", "2026-10-26T00:00:00Z")).toBe("2027-02-28T08:00:00.000Z");
  expect(next(plan, "UTC", "2027-12-01T00:00:00Z")).toBe("2028-02-29T08:00:00.000Z");
  expect(next(plan, "UTC", "2028-02-29T08:00:00Z")).toBe("2029-02-28T08:00:00.000Z");
});

test("once fires at its time and never again after it has passed", () => {
  const plan: Schedule = { kind: "once", date: "2026-12-25", time: "08:00" };
  expect(next(plan, "Europe/London", "2026-12-01T00:00:00Z")).toBe("2026-12-25T08:00:00.000Z");
  expect(next(plan, "Europe/London", "2026-12-25T08:00:00Z")).toBeUndefined();
});

test("schedules with an impossible date, a repeated day or a bad zone are rejected", () => {
  expect(schedule.safeParse({ kind: "once", date: "2026-02-31", time: "09:00" }).success).toBe(
    false,
  );
  expect(schedule.safeParse({ kind: "weekly", days: [1, 1], time: "09:00" }).success).toBe(false);
  expect(schedule.safeParse({ kind: "weekly", days: [], time: "09:00" }).success).toBe(false);
  expect(schedule.safeParse({ kind: "daily", time: "24:00" }).success).toBe(false);
  expect(timezone.safeParse("Mars/Olympus").success).toBe(false);
  expect(timezone.safeParse("Europe/Paris").success).toBe(true);
  expect(schedule.safeParse({ kind: "hourly", from: "17:00", to: "09:00" }).success).toBe(false);
  expect(schedule.safeParse({ kind: "yearly", month: 4, day: 31, time: "09:00" }).success).toBe(
    false,
  );
});

test("Noor creates a weekly reminder in the person's time zone with In app notification", async () => {
  const tools = automationTools({ owner: "user-a", timezone: "Asia/Tokyo" });
  const created = await tools.createAutomation.execute?.(
    {
      name: "Read Surah al-Kahf",
      prompt: "Remind me to read Surah al-Kahf.",
      schedule: { kind: "weekly", days: [5], time: "08:00" },
    },
    { toolCallId: "call-1", messages: [], context: {} },
  );
  expect(created).toMatchObject({
    name: "Read Surah al-Kahf",
    schedule: { kind: "weekly", days: [5], time: "08:00" },
    timezone: "Asia/Tokyo",
    notify: "app",
  });
  expect(insertedAutomations[0]?.[4]).toBe("Asia/Tokyo");
});
