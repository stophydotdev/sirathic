import { tool } from "ai";
import { z } from "zod";

const MONTHS = [
  "Muharram",
  "Safar",
  "Rabi al-Awwal",
  "Rabi al-Thani",
  "Jumada al-Ula",
  "Jumada al-Akhirah",
  "Rajab",
  "Shaban",
  "Ramadan",
  "Shawwal",
  "Dhul Qadah",
  "Dhul Hijjah",
] as const;

const EVENTS = [
  { name: "Ramadan begins", month: 9, day: 1 },
  { name: "Eid al-Fitr", month: 10, day: 1 },
  { name: "Day of Arafah", month: 12, day: 9 },
  { name: "Eid al-Adha", month: 12, day: 10 },
  { name: "Ashura", month: 1, day: 10 },
] as const;

const DAY_MS = 86_400_000;
const LOOKAHEAD_DAYS = 400;
const AH_EPOCH_MS = Date.UTC(622, 6, 19);
const HIJRI_YEAR_DAYS = 354.367;
const EXPECTED = "expected, pending local moon sighting";
const NOTE =
  "Calculated with the Umm al-Qura calendar. A Hijri day turns at Maghrib, and a month can start a day earlier or later where the moon is sighted locally, so say a start or an Eid is expected and send them to their local masjid.";

const hijriDay = z.object({
  year: z.int().min(1370).max(1490),
  month: z.int().min(1).max(12),
  day: z.int().min(1).max(30),
});

const gregorianDay = z.iso
  .date()
  .refine((date) => date >= "1950-01-01" && date <= "2060-12-31", "use a date from 1950 to 2060");

const input = z
  .object({
    gregorian: gregorianDay
      .optional()
      .describe("A Gregorian date as YYYY-MM-DD. Leave it out for today."),
    hijri: hijriDay.optional().describe("A Hijri date to convert to Gregorian."),
  })
  .refine(({ gregorian, hijri }) => gregorian === undefined || hijri === undefined, {
    message: "send gregorian or hijri, not both",
  });

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const weekdayFormat = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });

const hijriParts = z.object({
  year: z.coerce.number(),
  month: z.coerce.number(),
  day: z.coerce.number(),
});

const hijriOf = (date: Date) =>
  hijriParts.parse(
    Object.fromEntries(hijriFormat.formatToParts(date).map(({ type, value }) => [type, value])),
  );

const hijriText = ({ year, month, day }: z.output<typeof hijriParts>) =>
  `${day} ${MONTHS[month - 1]} ${year}`;

const dated = (date: Date) => ({
  gregorian: date.toISOString().slice(0, 10),
  weekday: weekdayFormat.format(date),
});

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const gregorianOf = ({ year, month, day }: z.output<typeof hijriDay>) => {
  const guess = new Date(
    AH_EPOCH_MS +
      Math.round(((year - 1) * HIJRI_YEAR_DAYS + (month - 1) * 29.53 + day - 1) * DAY_MS),
  );
  return Array.from({ length: 11 }, (_, i) => addDays(guess, i - 5)).find((date) => {
    const found = hijriOf(date);
    return found.year === year && found.month === month && found.day === day;
  });
};

const upcoming = (from: Date) => {
  const days = Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => addDays(from, i));
  return EVENTS.flatMap((event) => {
    const date = days.find((day) => {
      const found = hijriOf(day);
      return found.month === event.month && found.day === event.day;
    });
    return date
      ? [
          {
            name: event.name,
            hijri: `${event.day} ${MONTHS[event.month - 1]} ${hijriOf(date).year}`,
            ...dated(date),
            status: EXPECTED,
          },
        ]
      : [];
  }).toSorted((a, b) => a.gregorian.localeCompare(b.gregorian));
};

export const dayState = (gregorian: string) => {
  const date = new Date(`${gregorian}T00:00:00Z`);
  const { year, month, day } = hijriOf(date);
  return { ...dated(date), hijri: { day, month: MONTHS[month - 1], monthNumber: month, year } };
};

const answer = (date: Date) => ({
  ...dated(date),
  hijri: hijriText(hijriOf(date)),
  note: NOTE,
  upcoming: upcoming(date),
});

export const islamicDates = tool({
  description:
    "Converts between Hijri and Gregorian dates and lists the next Islamic dates: the start of Ramadan, Eid al-Fitr, the Day of Arafah, Eid al-Adha and Ashura. Pass gregorian (YYYY-MM-DD, the user's local date if you know it) for the Hijri date, hijri to get the Gregorian date, or nothing for today. Dates are calculated and can differ by a day from local sighting, so say a start or an Eid is expected. Use it instead of working out a Hijri date yourself.",
  inputSchema: input,
  execute: ({ gregorian, hijri }) => {
    if (!hijri)
      return answer(new Date(`${gregorian ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`));
    const date = gregorianOf(hijri);
    if (!date) throw new Error(`${hijriText(hijri)} does not exist: that month is shorter.`);
    return answer(date);
  },
});
