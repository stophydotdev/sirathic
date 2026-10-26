import type { Translate } from "@/components/i18n";
import type { api } from "@/lib/trpc";

export type Automation = Awaited<ReturnType<typeof api.automations.list.query>>[number];

export type Schedule = Automation["schedule"];

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const clockParts = (time: string) => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return { hour, minute };
};

export const clockText24 = (hour: number, minute: number) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export const hour12Of = (hour: number) => hour % 12 || 12;

export const hour24Of = (hour12: number, pm: boolean) => (hour12 % 12) + (pm ? 12 : 0);

export const uses12Hours = (locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 === true;

export const dayPeriods = (locale: string) => {
  const label = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
      .formatToParts(new Date(2000, 0, 1, hour))
      .find((part) => part.type === "dayPeriod")?.value ?? "";
  return { am: label(1), pm: label(13) };
};

const clockOf = (time: string) => {
  const { hour, minute } = clockParts(time);
  return new Date(2000, 0, 1, hour, minute);
};

export const dayOf = (date: string) => {
  const [year = 2000, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const SUNDAY = Date.UTC(2023, 0, 1);

const DAY_MS = 86_400_000;

export const weekdayNames = (locale: string, width: "narrow" | "short" | "long") =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
      SUNDAY + index * DAY_MS,
    ),
  );

export const monthNames = (locale: string, width: "short" | "long") =>
  Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { month: width }).format(new Date(2000, index, 1)),
  );

export const formatInstant = (locale: string, iso: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

export const clockText = (locale: string, clock: string) =>
  new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(clockOf(clock));

export function describeSchedule(t: Translate, locale: string, schedule: Schedule) {
  if (schedule.kind === "hourly") {
    return t("Every hour from {from} to {to}", {
      from: clockText(locale, schedule.from),
      to: clockText(locale, schedule.to),
    });
  }
  const time = clockText(locale, schedule.time);
  switch (schedule.kind) {
    case "once":
      return t("Once on {date} at {time}", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(dayOf(schedule.date)),
        time,
      });
    case "daily":
      return t("Every day at {time}", { time });
    case "weekly": {
      const names = weekdayNames(locale, "short");
      return t("Every {days} at {time}", {
        days: new Intl.ListFormat(locale, { type: "conjunction", style: "short" }).format(
          schedule.days.toSorted((a, b) => a - b).map((day) => names[day] ?? ""),
        ),
        time,
      });
    }
    case "monthly":
      return t("Monthly on day {day} at {time}", { day: schedule.day, time });
    case "yearly":
      return t("Every year on {date} at {time}", {
        date: new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(
          new Date(2000, schedule.month - 1, schedule.day),
        ),
        time,
      });
  }
}
