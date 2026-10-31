import { tool } from "ai";
import { z } from "zod";
import { timezone } from "../shared/settings";
import { PRAYERS } from "../shared/cards";
import { prayerPlace, prayerTimesOn } from "./times";

const MAX_DAYS = 31;

const NOTE =
  "Calculated, not a masjid timetable. A masjid's times can differ by a few minutes, and Fajr and Isha by more far from the equator. Iqamah and Jumu'ah times are set by each masjid.";

const input = prayerPlace.extend({
  place: z.string().max(80).optional().describe("The city or masjid, shown on the card."),
  timezone: timezone.describe("The place's IANA time zone, like Europe/London."),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional()
    .describe("The first day, YYYY-MM-DD, in the place. Today there when left out."),
  days: z
    .number()
    .int()
    .min(1)
    .max(MAX_DAYS)
    .default(1)
    .describe("How many days, up to 31, like 30 for a Ramadan timetable."),
});

export const prayerTimes = tool({
  description:
    "Calculates the prayer times (Fajr, sunrise, Dhuhr, Asr, Maghrib, Isha) for a place over up to 31 days from its coordinates. Use it whenever an answer depends on a prayer time, like suhoor ending at Fajr or iftar at Maghrib, instead of working one out or quoting it from memory. Give the coordinates of the user's city or masjid and the method its local authority uses, and say which method you used. The user sees the times as a card, so don't repeat the whole timetable in your answer; name only the times it needs.",
  inputSchema: input,
  execute: ({ timezone: zone, from, days, place: where, ...place }) => {
    const clock = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const start = from ?? new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date());
    const [year, month, day] = start.split("-").map(Number);
    return {
      place: where,
      method: place.method,
      asr: place.asr,
      timezone: zone,
      note: NOTE,
      days: Array.from({ length: days }, (_, index) => {
        const times = prayerTimesOn(place, { year, month, day: day + index });
        return {
          date: new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10),
          ...Object.fromEntries(PRAYERS.map((name) => [name, clock.format(times[name])])),
        };
      }),
    };
  },
});
