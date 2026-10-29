import type { Schedule } from "@sirathic/server/automations";
import type { api } from "./api";

export type Automation = Awaited<ReturnType<typeof api.automations.list.query>>[number];
export type Run = Awaited<ReturnType<typeof api.automations.runs.query>>[number];

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const clockParts = (time: string) => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return { hour, minute };
};

export const clockText = (time: string) => {
  const { hour, minute } = clockParts(time);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(2000, 0, 1, hour, minute),
  );
};

export const dayOf = (date: string) => {
  const [year = 2000, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const dateText = (date: Date) =>
  `${MONTHS[date.getMonth()]?.slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;

export const formatInstant = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export const dayList = (days: readonly number[]) => {
  const sorted = [...days];
  sorted.sort((a, b) => a - b);
  const names = sorted.map((day) => WEEKDAYS[day]?.slice(0, 3) ?? "");
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

export function describeSchedule(schedule: Schedule) {
  if (schedule.kind === "hourly") {
    return `Every hour from ${clockText(schedule.from)} to ${clockText(schedule.to)}`;
  }
  const time = clockText(schedule.time);
  switch (schedule.kind) {
    case "once":
      return `Once on ${dateText(dayOf(schedule.date))} at ${time}`;
    case "daily":
      return `Every day at ${time}`;
    case "weekly":
      return `Every ${dayList(schedule.days)} at ${time}`;
    case "monthly":
      return `Monthly on day ${schedule.day} at ${time}`;
    case "yearly":
      return `Every year on ${MONTHS[schedule.month - 1]} ${schedule.day} at ${time}`;
  }
}
