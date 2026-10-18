import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
} from "adhan";
import { z } from "zod";
import { toHijri } from "./hijriDate";
import {
  addDays,
  latitudeSchema,
  longitudeSchema,
  timeZoneSchema,
  weekdayOf,
  zonedParts,
} from "../zoned";

type MethodEntry = {
  adhan: Exclude<keyof typeof CalculationMethod, "Other">;
  name: string;
};

const methodIds = [
  "muslim_world_league",
  "umm_al_qura",
  "isna",
  "egyptian",
  "karachi",
  "moonsighting_committee",
  "dubai",
  "kuwait",
  "qatar",
  "singapore",
  "tehran",
  "turkey",
] as const;

type MethodId = (typeof methodIds)[number];

const METHODS = {
  muslim_world_league: {
    adhan: "MuslimWorldLeague",
    name: "Muslim World League",
  },
  umm_al_qura: { adhan: "UmmAlQura", name: "Umm al-Qura University, Makkah" },
  isna: {
    adhan: "NorthAmerica",
    name: "Islamic Society of North America (ISNA)",
  },
  egyptian: {
    adhan: "Egyptian",
    name: "Egyptian General Authority of Survey",
  },
  karachi: {
    adhan: "Karachi",
    name: "University of Islamic Sciences, Karachi",
  },
  moonsighting_committee: {
    adhan: "MoonsightingCommittee",
    name: "Moonsighting Committee Worldwide",
  },
  dubai: {
    adhan: "Dubai",
    name: "Dubai (UAE)",
  },
  kuwait: { adhan: "Kuwait", name: "Kuwait" },
  qatar: { adhan: "Qatar", name: "Qatar" },
  singapore: {
    adhan: "Singapore",
    name: "Singapore (also used in Malaysia and Indonesia)",
  },
  tehran: {
    adhan: "Tehran",
    name: "Institute of Geophysics, University of Tehran",
  },
  turkey: {
    adhan: "Turkey",
    name: "Diyanet (Turkey), approximated",
  },
} satisfies Record<MethodId, MethodEntry>;

const METHOD_NOTES = new Map<MethodId, string>([
  [
    "moonsighting_committee",
    "Adds 5 minutes to Dhuhr and 3 minutes to Maghrib as safety margins and adjusts Fajr and Isha by season. Often recommended for the UK and North America.",
  ],
  [
    "dubai",
    "Adds 3 minutes to Dhuhr, Asr and Maghrib and takes 3 off sunrise, as the UAE does.",
  ],
  [
    "turkey",
    "An approximation of the Diyanet timetable, less accurate outside Turkey.",
  ],
]);

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
const RAMADAN = 9;
const UMM_AL_QURA_RAMADAN_ISHA_EXTRA_MINUTES = 30;
const HIGH_LATITUDE_DEGREES = 48;

export const prayerTimesInput = z.object({
  latitude: latitudeSchema.describe("Latitude in decimal degrees"),
  longitude: longitudeSchema.describe("Longitude in decimal degrees"),
  timezone: timeZoneSchema.describe(
    "IANA time zone of the location, for example Europe/London",
  ),
  date: z.iso
    .date()
    .optional()
    .describe("Local date YYYY-MM-DD. Leave out for today."),
  method: z
    .enum(methodIds)
    .default("muslim_world_league")
    .describe("The method the user's mosque or country follows."),
  asrSchool: z
    .enum(["shafii", "hanafi"])
    .default("shafii")
    .describe("shafii (the majority) or hanafi (later Asr)."),
});

const localDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const prayerTimes = (
  input: z.input<typeof prayerTimesInput>,
  now = new Date(),
) => {
  const parsed = prayerTimesInput.parse(input);
  const { latitude, longitude, timezone, method, asrSchool } = parsed;
  const date = parsed.date ?? zonedParts(now, timezone).date;
  const coordinates = new Coordinates(latitude, longitude);
  const ramadan = toHijri(date).month === RAMADAN;
  const extraIsha =
    method === "umm_al_qura" && ramadan
      ? UMM_AL_QURA_RAMADAN_ISHA_EXTRA_MINUTES
      : 0;

  const parameters = CalculationMethod[METHODS[method].adhan]();
  parameters.madhab = asrSchool === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  parameters.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  parameters.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  parameters.adjustments.isha = extraIsha;

  const timesOn = (isoDate: string) =>
    new PrayerTimes(coordinates, localDate(isoDate), parameters);

  const entry = (instant: Date) =>
    Number.isNaN(instant.getTime())
      ? null
      : {
          time: zonedParts(instant, timezone).clock,
          iso: instant.toISOString(),
        };

  const today = timesOn(date);
  const times = {
    fajr: entry(today.fajr),
    sunrise: entry(today.sunrise),
    dhuhr: entry(today.dhuhr),
    asr: entry(today.asr),
    maghrib: entry(today.maghrib),
    isha: entry(today.isha),
  };

  const upcoming = () => {
    const later = PRAYERS.find((prayer) => today[prayer] > now);
    if (later !== undefined) {
      return { prayer: later, at: today[later], date };
    }
    const tomorrow = addDays(date, 1);
    return { prayer: "fajr", at: timesOn(tomorrow).fajr, date: tomorrow };
  };

  const next =
    date === zonedParts(now, timezone).date &&
    !Number.isNaN(today.fajr.getTime())
      ? upcoming()
      : null;

  return {
    date,
    weekday: weekdayOf(date),
    timezone,
    latitude,
    longitude,
    times,
    next:
      next === null
        ? null
        : {
            prayer: next.prayer,
            date: next.date,
            ...entry(next.at),
            minutesUntil: Math.ceil(
              (next.at.getTime() - now.getTime()) / 60_000,
            ),
          },
    basis: {
      method: {
        id: method,
        name: METHODS[method].name,
        note: METHOD_NOTES.get(method) ?? null,
        fajrAngleDegrees: parameters.fajrAngle,
        ishaAngleDegrees:
          parameters.ishaInterval > 0 ? null : parameters.ishaAngle,
        ishaMinutesAfterMaghrib:
          parameters.ishaInterval > 0
            ? parameters.ishaInterval + extraIsha
            : null,
      },
      asr: {
        school: asrSchool,
        rule:
          asrSchool === "hanafi"
            ? "Asr starts when an object's shadow is twice its length (Hanafi)"
            : "Asr starts when an object's shadow equals its length (Shafi'i, Maliki, Hanbali)",
      },
      highLatitudeRule: parameters.highLatitudeRule,
      source: "adhan-js astronomical calculation",
    },
    caveats: [
      "These times are calculated, not observed. A local mosque timetable can differ by a few minutes, so follow it where there is one.",
      ...(extraIsha > 0
        ? [
            "Umm al-Qura sets Isha 120 minutes after Maghrib in Ramadan (90 otherwise). That is applied here.",
          ]
        : []),
      ...(Math.abs(latitude) > HIGH_LATITUDE_DEGREES
        ? [
            "At this latitude twilight can last all night in summer, so Fajr and Isha use the high-latitude rule above. Scholars differ on the right rule, so follow the local community's timetable.",
          ]
        : []),
      ...(weekdayOf(date) === "Friday"
        ? [
            "On Friday the Dhuhr time marks the start of the Jumu'ah window. The khutbah time is set by the local mosque.",
          ]
        : []),
    ],
  };
};
