import { expect, mock, test } from "bun:test";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { drizzle } from "drizzle-orm/pg-proxy";
import type { ChatMessage } from "../apps/server/src/shared/messages";
import { nextRun, schedule, type Schedule } from "../apps/server/src/automations/schedule";
import { prayerTimesOn, type PrayerPlace } from "../apps/server/src/prayer/times";
import { PRAYERS } from "../apps/server/src/shared/cards";
import { timezone } from "../apps/server/src/shared/settings";

const automationId = "11111111-1111-4111-8111-111111111111";
const dueAt = new Date(Date.now() - 60_000).toISOString();

type StoredAutomation = {
  nextRunAt: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  failures: number;
  plan: Schedule;
};

const automationRow: StoredAutomation = {
  nextRunAt: dueAt,
  enabled: true,
  lastRunAt: null,
  failures: 0,
  plan: { kind: "once", date: "2026-10-26", time: "09:00" },
};
const botId = "22222222-2222-4222-8222-222222222222";
let botRoutine = false;
let storedBotChat: unknown[] = [];
const savedChats: unknown[][] = [];

const fakeDb = drizzle(
  async (sql, params) => {
    if (sql.startsWith('select "id", "owner"') && sql.includes('from "automations"')) {
      return {
        rows: automationRow.enabled
          ? [
              [
                automationId,
                "user-a",
                botRoutine ? botId : null,
                botRoutine ? "Morning verse" : "Eid reminder",
                botRoutine ? "One new verse each morning" : "Remind me of the Eid sunnahs",
                automationRow.plan,
                "UTC",
                true,
                automationRow.nextRunAt,
                null,
                dueAt,
                dueAt,
                null,
                "research",
                "app",
                automationRow.failures,
              ],
            ]
          : [],
      };
    }
    if (sql.startsWith('update "automations" set')) {
      for (const [, column, index] of (sql.split(" where ")[0] ?? "").matchAll(
        /"(\w+)" = \$(\d+)/g,
      )) {
        const field = column.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase());
        Object.assign(automationRow, { [field]: params[Number(index) - 1] });
      }
      return { rows: [[automationId]] };
    }
    if (sql.startsWith('select "id", "email"')) {
      return { rows: [["user-a", "a@example.com", null, null, null]] };
    }
    if (sql.startsWith("select count(*)")) return { rows: [[0]] };
    if (sql.startsWith('select "id", "name" from "projects"')) return { rows: [[botId, "Bot"]] };
    if (sql.startsWith('select "messages"')) return { rows: [[storedBotChat, false, botId]] };
    if (sql.startsWith('select "project_id" from "chat_sessions"')) return { rows: [] };
    if (sql.includes('from "bot_items"') || sql.includes('from "projects"')) return { rows: [] };
    if (sql.startsWith('update "chat_sessions"')) return { rows: [] };
    if (sql.startsWith('insert into "chat_sessions"')) {
      savedChats.push(params);
      return { rows: [[botId]] };
    }
    throw new Error(`unexpected query: ${sql}`);
  },
  { casing: "snake_case" },
);

mock.module("@sirathic/db", () => ({ db: fakeDb }));
const cache = await import("@sirathic/core/cache");
let usedTokens = 25_000_000;
mock.module("@sirathic/core/cache", () => ({
  ...cache,
  countOf: async () => ({ total: usedTokens, leftMs: 60_000 }),
}));
const response = await import("../apps/server/src/chat/response");
const modelInputs: ChatMessage[][] = [];
const citedInputs: (ChatMessage[] | undefined)[] = [];
let modelError: string | undefined;
mock.module("../apps/server/src/chat/response", () => ({
  ...response,
  chatResponse: ({ messages, save, citedEarlier }: Parameters<typeof response.chatResponse>[0]) => {
    modelInputs.push(messages);
    citedInputs.push(citedEarlier);
    const reply = {
      id: "reply-1",
      role: "assistant",
      metadata: { createdAt: 1, mode: "quick" },
      parts: [{ type: "text", text: "Verse 33\nAn-Nasr 110:1" }],
    } satisfies ChatMessage;
    if (modelError !== undefined) {
      const errorText = modelError;
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            await save([
              ...messages,
              { ...reply, parts: [{ type: "text", text: "Let me check." }] },
            ]);
            writer.write({ type: "error", errorText });
          },
        }),
      });
    }
    return new Response(
      new ReadableStream({
        start: (controller) => save([...messages, reply]).then(() => controller.close()),
      }),
    );
  },
}));

const { isSkip, runDue } = await import("../apps/server/src/automations/runner");

test("a run that fails still saves an unread chat with the reason and ends the one-time automation", async () => {
  const logged = console.error;
  console.error = () => {};
  modelError = "529: overloaded";
  await Promise.all(await runDue());
  modelError = undefined;
  console.error = logged;

  expect(automationRow.enabled).toBe(false);
  expect(automationRow.nextRunAt).toBeNull();
  expect(automationRow.lastRunAt).not.toBeNull();
  expect(savedChats).toHaveLength(1);
  const [, owner, title, messages, unread, savedFor] = savedChats[0];
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
    ["assistant", "research", "This run did not finish. 529: overloaded"],
  ]);
});

const runDueQuietly = async () => {
  const logged = console.error;
  console.error = () => {};
  await Promise.all(await runDue());
  console.error = logged;
};

const lastSavedText = () => {
  const messages: ChatMessage[] = JSON.parse(String(savedChats.at(-1)?.[3]));
  return messages.at(-1)?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []));
};

test("a failing routine posts its first failure, stays quiet on the second and pauses on the third", async () => {
  Object.assign(automationRow, {
    plan: { kind: "daily", time: "09:00" },
    enabled: true,
    failures: 0,
  });
  savedChats.length = 0;
  const runOnce = async () => {
    automationRow.nextRunAt = dueAt;
    await runDueQuietly();
    return [savedChats.length, automationRow.failures, automationRow.enabled];
  };

  modelError = "529: overloaded";
  const runs = [await runOnce(), await runOnce(), await runOnce()];
  modelError = undefined;

  expect(runs).toEqual([
    [1, 1, true],
    [1, 2, true],
    [2, 3, false],
  ]);
  expect(lastSavedText()).toEqual([
    "Paused after 3 failed runs in a row. Turn it back on in Automations.",
  ]);
  expect(automationRow.nextRunAt).toBeNull();
});

test("a sign-in failure is told every time and never counts toward pausing", async () => {
  Object.assign(automationRow, {
    plan: { kind: "daily", time: "09:00" },
    enabled: true,
    failures: 1,
  });
  savedChats.length = 0;
  modelError = "your ChatGPT sign-in ended, sign in again";
  const runOnce = async () => {
    automationRow.nextRunAt = dueAt;
    await runDueQuietly();
  };

  await runOnce();
  await runOnce();
  await runOnce();
  modelError = undefined;

  expect([savedChats.length, automationRow.failures, automationRow.enabled]).toEqual([3, 1, true]);
  expect(lastSavedText()).toEqual([
    "This run did not finish. your ChatGPT sign-in ended, sign in again",
  ]);
});

test("a routine runs even when the user has used Noor's limit in chat", async () => {
  Object.assign(automationRow, { enabled: true, nextRunAt: dueAt, failures: 0 });
  usedTokens = 25_000_000;

  await runDueQuietly();

  expect(automationRow.failures).toBe(0);
  expect(lastSavedText()).toEqual(["Verse 33\nAn-Nasr 110:1"]);
});

test("a run missed by more than an hour is skipped and the next one is scheduled", async () => {
  const missedAt = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  Object.assign(automationRow, { enabled: true, nextRunAt: missedAt });
  savedChats.length = 0;
  modelInputs.length = 0;

  await runDueQuietly();

  expect([savedChats, modelInputs]).toEqual([[], []]);
  expect(Date.parse(String(automationRow.nextRunAt))).toBeGreaterThan(Date.now());
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

test("a routine reply of SKIP stays out of the chat, any other reply is a post", () => {
  expect(["SKIP", " skip.\n", "Skip!"].map(isSkip)).toEqual([true, true, true]);
  expect(["Nothing to skip today.", "3 items are due.", ""].map(isSkip)).toEqual([
    false,
    false,
    false,
  ]);
});

test("a bot routine run sends the model only its brief, numbers citations after the chat's and appends to it", async () => {
  const routine = "Morning verse";
  const post = (index: number): ChatMessage[] => {
    const number = String(index).padStart(2, "0");
    return [
      {
        id: `ask-${number}`,
        role: "user",
        metadata: { createdAt: index, mode: "quick", routine },
        parts: [{ type: "text", text: "One new verse each morning" }],
      },
      {
        id: `post-${number}`,
        role: "assistant",
        metadata: { createdAt: index, mode: "quick" },
        parts: [{ type: "text", text: `Verse ${number}\n${"long body ".repeat(40)}` }],
      },
    ];
  };
  const earlier = Array.from({ length: 32 }, (_, index) => post(index + 1)).flat();
  storedBotChat = earlier;
  botRoutine = true;
  usedTokens = 0;
  Object.assign(automationRow, { enabled: true, nextRunAt: dueAt });
  savedChats.length = 0;
  modelInputs.length = 0;
  citedInputs.length = 0;

  await Promise.all(await runDue());

  expect(modelInputs).toHaveLength(1);
  expect(citedInputs).toEqual([earlier]);
  const [briefed, ...rest] = modelInputs[0] ?? [];
  expect(rest).toEqual([]);
  const lines = briefed?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []));
  const topics = lines
    ?.join("")
    .split("\n")
    .filter((line) => line.startsWith("- "));
  expect(topics).toEqual(
    Array.from({ length: 30 }, (_, index) => `- Verse ${String(index + 3).padStart(2, "0")}`),
  );
  expect(lines?.join("")).toContain("Do not repeat any of them.");

  const appended: ChatMessage[] = JSON.parse(String(savedChats[0]?.[3]));
  expect(appended).toHaveLength(2);
  expect(appended[0]?.parts).toEqual([{ type: "text", text: "One new verse each morning" }]);
  expect(appended[1]?.id).toBe("reply-1");
});

const MINUTE_MS = 60_000;

const minutesIn = (zone: string, instant: Date) => {
  const [hour = 0, minute = 0] = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(instant)
    .split(":")
    .map(Number);
  return hour * 60 + minute;
};

const official = [
  {
    authority: "JAKIM, Kuala Lumpur (WLY01)",
    place: { latitude: 3.139, longitude: 101.6869, method: "Malaysia", asr: "standard" },
    zone: "Asia/Kuala_Lumpur",
    date: { year: 2026, month: 10, day: 30 },
    times: ["05:48", "06:56", "13:00", "16:19", "18:59", "20:09"],
  },
  {
    authority: "Diyanet, Istanbul",
    place: { latitude: 41.0082, longitude: 28.9784, method: "Turkey", asr: "standard" },
    zone: "Europe/Istanbul",
    date: { year: 2026, month: 10, day: 30 },
    times: ["05:59", "07:25", "12:53", "15:43", "18:10", "19:31"],
  },
] satisfies {
  authority: string;
  place: PrayerPlace;
  zone: string;
  date: { year: number; month: number; day: number };
  times: string[];
}[];

test.each(official)("prayer times are within two minutes of $authority", (row) => {
  const times = prayerTimesOn(row.place, row.date);
  const gaps = PRAYERS.map((prayer, index) => {
    const [hour = 0, minute = 0] = (row.times[index] ?? "").split(":").map(Number);
    return Math.abs(minutesIn(row.zone, times[prayer]) - (hour * 60 + minute));
  });
  expect(Math.max(...gaps)).toBeLessThanOrEqual(2);
});

test("Umm al-Qura Isha moves to two hours after Maghrib from the first night of Ramadan", () => {
  const makkah = {
    latitude: 21.4225,
    longitude: 39.8262,
    method: "UmmAlQura",
    asr: "standard",
  } satisfies PrayerPlace;
  const gap = (day: number) => {
    const times = prayerTimesOn(makkah, { year: 2026, month: 2, day });
    return (times.isha.getTime() - times.maghrib.getTime()) / MINUTE_MS;
  };
  expect(gap(16)).toBe(90);
  expect(gap(17)).toBe(120);
  expect(gap(18)).toBe(120);
});

test("a routine tied to a prayer moves with it every day, even past midnight", () => {
  const london = {
    latitude: 51.5074,
    longitude: -0.1278,
    method: "MuslimWorldLeague",
    asr: "standard",
  } satisfies PrayerPlace;
  const zone = "Europe/London";
  const beforeMaghrib: Schedule = {
    kind: "daily",
    time: "16:22",
    prayer: { ...london, name: "maghrib", minutes: -15 },
  };
  expect(nextRun(beforeMaghrib, zone, new Date("2026-10-30T12:00:00Z"))?.toISOString()).toBe(
    "2026-10-30T16:22:00.000Z",
  );
  expect(nextRun(beforeMaghrib, zone, new Date("2026-10-30T16:30:00Z"))?.toISOString()).toBe(
    "2026-10-31T16:20:00.000Z",
  );
  const afterIsha: Schedule = {
    kind: "daily",
    time: "00:25",
    prayer: { ...london, name: "isha", minutes: 120 },
  };
  const run =
    prayerTimesOn(london, { year: 2026, month: 6, day: 21 }).isha.getTime() + 120 * MINUTE_MS;
  expect(minutesIn(zone, new Date(run))).toBeLessThan(60);
  expect(nextRun(afterIsha, zone, new Date("2026-06-21T23:01:00Z"))?.getTime()).toBe(run);
});
