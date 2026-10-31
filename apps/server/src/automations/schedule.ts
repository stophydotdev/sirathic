import { z } from "zod";
import { PRAYERS } from "../shared/cards";
import { prayerPlace, prayerTimesOn } from "../prayer/times";

const SEARCH_DAYS = 366;

const MAX_PRAYER_OFFSET = 180;

const LEAP_YEAR = 2024;

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((date) => new Date(`${date}T00:00:00Z`).toISOString().startsWith(date), "no such date");

export const schedule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("once"), date: isoDate, time }),
  z
    .object({ kind: z.literal("hourly"), from: time, to: time })
    .refine((window) => window.to >= window.from, "the window ends before it starts"),
  z.object({
    kind: z.literal("daily"),
    time,
    prayer: prayerPlace
      .extend({
        name: z.enum(PRAYERS),
        minutes: z
          .number()
          .int()
          .min(-MAX_PRAYER_OFFSET)
          .max(MAX_PRAYER_OFFSET)
          .describe("Minutes after the prayer time, negative for before."),
      })
      .optional()
      .describe(
        "Moves the run every day with this prayer time at the user's place. time is today's run time.",
      ),
  }),
  z.object({
    kind: z.literal("weekly"),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .refine((days) => new Set(days).size === days.length, "repeated day"),
    time,
  }),
  z.object({ kind: z.literal("monthly"), day: z.number().int().min(1).max(31), time }),
  z
    .object({
      kind: z.literal("yearly"),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
      time,
    })
    .refine((date) => date.day <= daysIn(LEAP_YEAR, date.month), "no such date"),
]);

export type Schedule = z.infer<typeof schedule>;

export const NOTIFY = ["app", "none"] as const;

export const notify = z.enum(NOTIFY);

const wallClock = (instant: number, zone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
};

const wallAsUtc = (instant: number, zone: string) => {
  const { year, month, day, hour, minute } = wallClock(instant, zone);
  return Date.UTC(year, month - 1, day, hour, minute);
};

const MINUTE_MS = 60_000;

const instantAt = (
  date: { year: number; month: number; day: number },
  clock: string,
  zone: string,
) => {
  const [hour, minute] = clock.split(":").map(Number);
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const guess = (from: number) =>
    wall - (wallAsUtc(from, zone) - Math.floor(from / MINUTE_MS) * MINUTE_MS);
  const first = guess(wall);
  const second = guess(first);
  return wallAsUtc(second, zone) === wall ? second : Math.max(first, second);
};

const clocksOf = (plan: Exclude<Schedule, { kind: "once" }>) => {
  if (plan.kind !== "hourly") return [plan.time];
  const [first, minute] = plan.from.split(":");
  const clocks: string[] = [];
  for (let hour = Number(first); hour < 24; hour++) {
    const clock = `${String(hour).padStart(2, "0")}:${minute}`;
    if (clock > plan.to) break;
    clocks.push(clock);
  }
  return clocks;
};

const runsOn = (plan: Schedule, day: Date) => {
  if (plan.kind === "weekly") return plan.days.includes(day.getUTCDay());
  if (plan.kind === "monthly") {
    return (
      day.getUTCDate() === Math.min(plan.day, daysIn(day.getUTCFullYear(), day.getUTCMonth() + 1))
    );
  }
  if (plan.kind === "yearly") {
    return (
      day.getUTCMonth() + 1 === plan.month &&
      day.getUTCDate() === Math.min(plan.day, daysIn(day.getUTCFullYear(), plan.month))
    );
  }
  return true;
};

export function nextRun(plan: Schedule, zone: string, after: Date) {
  if (plan.kind === "once") {
    const [year, month, day] = plan.date.split("-").map(Number);
    const at = instantAt({ year, month, day }, plan.time, zone);
    return at > after.getTime() ? new Date(at) : undefined;
  }
  const today = wallClock(after.getTime(), zone);
  if (plan.kind === "daily" && plan.prayer) {
    for (let offset = -1; offset < 3; offset++) {
      const at =
        prayerTimesOn(plan.prayer, { ...today, day: today.day + offset })[
          plan.prayer.name
        ].getTime() +
        plan.prayer.minutes * MINUTE_MS;
      if (at > after.getTime()) return new Date(at);
    }
    return undefined;
  }
  for (let offset = 0; offset < SEARCH_DAYS; offset++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    if (!runsOn(plan, day)) continue;
    const date = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
    };
    for (const clock of clocksOf(plan)) {
      const at = instantAt(date, clock, zone);
      if (at > after.getTime()) return new Date(at);
    }
  }
  return undefined;
}
