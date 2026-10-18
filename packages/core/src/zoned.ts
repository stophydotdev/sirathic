import { z } from "zod";

const isTimeZone = (timeZone: string) => {
  try {
    return (
      new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone !==
      ""
    );
  } catch {
    return false;
  }
};

export const timeZoneSchema = z
  .string()
  .refine(isTimeZone, "Not a valid IANA time zone, for example Europe/London");

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export const zonedParts = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    clock: `${part("hour")}:${part("minute")}`,
  };
};

export const weekdayOf = (isoDate: string) =>
  new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );

export const addDays = (isoDate: string, days: number) =>
  new Date(Date.parse(`${isoDate}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

export const round = (value: number, places: number) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
