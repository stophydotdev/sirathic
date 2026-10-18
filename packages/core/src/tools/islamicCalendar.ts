import { z } from "zod";
import {
  describeHijri,
  HIJRI_CAVEATS,
  toGregorian,
  toHijri,
} from "./hijriDate";
import { weekdayOf } from "../zoned";

const EVENTS = [
  { id: "islamic_new_year", name: "Islamic New Year", month: 1, day: 1 },
  { id: "ashura", name: "Ashura", month: 1, day: 10 },
  { id: "ramadan_start", name: "First day of Ramadan", month: 9, day: 1 },
  { id: "eid_al_fitr", name: "Eid al-Fitr", month: 10, day: 1 },
  { id: "day_of_arafah", name: "Day of Arafah", month: 12, day: 9 },
  { id: "eid_al_adha", name: "Eid al-Adha", month: 12, day: 10 },
] as const;

const GREGORIAN_RANGE = { first: 1901, last: 2169 };
const HIJRI_RANGE = { first: 1319, last: 1589 };

export const islamicCalendarInput = z
  .object({
    year: z.number().int().describe("The year, for example 2027 or 1448"),
    calendar: z
      .enum(["gregorian", "hijri"])
      .default("gregorian")
      .describe("Which calendar the year is in"),
  })
  .superRefine(({ year, calendar }, context) => {
    const range = calendar === "hijri" ? HIJRI_RANGE : GREGORIAN_RANGE;
    if (year < range.first || year > range.last) {
      context.addIssue({
        code: "custom",
        path: ["year"],
        message: `A ${calendar} year must be between ${range.first} and ${range.last}`,
      });
    }
  });

const yearsTouching = (gregorianYear: number) => {
  const first = toHijri(`${gregorianYear}-01-01`).year;
  const last = toHijri(`${gregorianYear}-12-31`).year;
  return Array.from({ length: last - first + 1 }, (_, step) => first + step);
};

const eventsOfHijriYear = (hijriYear: number) =>
  EVENTS.flatMap((event) => {
    const date = toGregorian({
      year: hijriYear,
      month: event.month,
      day: event.day,
    });
    return date === undefined
      ? []
      : [
          {
            id: event.id,
            name: event.name,
            hijri: describeHijri({
              year: hijriYear,
              month: event.month,
              day: event.day,
            }),
            gregorian: { date, weekday: weekdayOf(date) },
          },
        ];
  });

export const islamicCalendar = (
  input: z.input<typeof islamicCalendarInput>,
) => {
  const { year, calendar } = islamicCalendarInput.parse(input);
  const candidates =
    calendar === "hijri"
      ? eventsOfHijriYear(year)
      : yearsTouching(year)
          .flatMap(eventsOfHijriYear)
          .filter((event) => event.gregorian.date.startsWith(`${year}-`));
  return {
    year,
    calendar,
    events: candidates.toSorted((a, b) =>
      a.gregorian.date.localeCompare(b.gregorian.date),
    ),
    basis:
      "Estimated from the Umm al-Qura calendar (Intl islamic-umalqura). Eid al-Fitr is 1 Shawwal, Day of Arafah is 9 Dhul Hijjah and Eid al-Adha is 10 Dhul Hijjah.",
    caveats: [
      ...HIJRI_CAVEATS,
      "Ramadan and the Eids are decided by moon sighting in most countries, so the real date can be a day later (or earlier) than this estimate.",
      "The Day of Arafah is observed on the day pilgrims stand at Arafah in Makkah.",
      "Observances begin the evening before the date shown, for example the first tarawih prayer and the night of Ashura.",
    ],
  };
};
