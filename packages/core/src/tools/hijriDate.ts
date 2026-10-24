import { z } from "zod";
import { addDays, timeZoneSchema, weekdayOf, zonedParts } from "../zoned";

const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Ula",
  "Jumada al-Akhirah",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhul Qa'dah",
  "Dhul Hijjah",
] as const;

const FIRST_GREGORIAN_DATE = "1900-01-01";
const LAST_GREGORIAN_DATE = "2170-12-31";
const FIRST_HIJRI_YEAR = 1318;
const LAST_HIJRI_YEAR = 1590;

const DAY_MS = 86_400_000;
const EPOCH_MS = Date.UTC(622, 6, 19);
const MEAN_YEAR_DAYS = 354.36707;
const MEAN_MONTH_DAYS = 29.530589;
const SEARCH_RADIUS_DAYS = 8;

export type HijriDate = { year: number; month: number; day: number };

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export const toHijri = (isoDate: string) => {
  const parts = hijriFormat.formatToParts(new Date(`${isoDate}T12:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
};

const sameHijri = (a: HijriDate, b: HijriDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

export const toGregorian = (target: HijriDate) => {
  const meanDays =
    (target.year - 1) * MEAN_YEAR_DAYS + (target.month - 1) * MEAN_MONTH_DAYS + target.day - 1;
  const center = new Date(EPOCH_MS + meanDays * DAY_MS).toISOString().slice(0, 10);
  return Array.from({ length: SEARCH_RADIUS_DAYS * 2 + 1 }, (_, step) =>
    addDays(center, step - SEARCH_RADIUS_DAYS),
  ).find((candidate) => sameHijri(toHijri(candidate), target));
};

export const describeHijri = ({ year, month, day }: HijriDate) => {
  const monthName = HIJRI_MONTHS[month - 1];
  return {
    year,
    month,
    monthName,
    day,
    text: `${day} ${monthName} ${year} AH`,
  };
};

export const HIJRI_CAVEATS = [
  "The Umm al-Qura calendar is computed in advance (the Saudi civil calendar). Actual month starts follow local moon sighting and can differ by a day.",
  "A Hijri day begins at sunset, so after Maghrib the Hijri date is one day ahead of the one shown for that Gregorian date.",
];

const hijriInput = z.object({
  year: z.number().int().min(FIRST_HIJRI_YEAR).max(LAST_HIJRI_YEAR),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(30),
});

export const hijriDateInput = z
  .object({
    date: z.iso
      .date()
      .refine(
        (value) => value >= FIRST_GREGORIAN_DATE && value <= LAST_GREGORIAN_DATE,
        `Date must be between ${FIRST_GREGORIAN_DATE} and ${LAST_GREGORIAN_DATE}`,
      )
      .optional()
      .describe("Gregorian date YYYY-MM-DD to convert to Hijri. Leave out for today."),
    hijri: hijriInput.optional().describe("A Hijri date to convert to Gregorian instead"),
    timezone: timeZoneSchema.default("UTC").describe("IANA time zone used to find today's date"),
  })
  .refine(
    (value) => value.date === undefined || value.hijri === undefined,
    "Give either date or hijri, not both",
  );

const gregorianOf = (hijri: HijriDate) => {
  const gregorian = toGregorian(hijri);
  if (gregorian === undefined) {
    throw new Error(
      `${describeHijri(hijri).text} does not exist: that month has 29 days in the Umm al-Qura calendar.`,
    );
  }
  return gregorian;
};

export const hijriDate = (input: z.input<typeof hijriDateInput>, now = new Date()) => {
  const { date, hijri, timezone } = hijriDateInput.parse(input);
  const gregorian =
    hijri === undefined ? (date ?? zonedParts(now, timezone).date) : gregorianOf(hijri);
  return {
    direction: hijri === undefined ? "gregorian_to_hijri" : "hijri_to_gregorian",
    gregorian: { date: gregorian, weekday: weekdayOf(gregorian) },
    hijri: describeHijri(hijri ?? toHijri(gregorian)),
    calendar: "Umm al-Qura (computed, via the Intl islamic-umalqura calendar)",
    caveats: HIJRI_CAVEATS,
  };
};
