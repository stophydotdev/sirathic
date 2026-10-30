import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
  Rounding,
} from "adhan";
import { z } from "zod";

export const PRAYERS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

const METHODS = [
  "Malaysia",
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "UmmAlQura",
  "Dubai",
  "MoonsightingCommittee",
  "NorthAmerica",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Tehran",
  "Turkey",
] as const satisfies readonly (keyof typeof CalculationMethod | "Malaysia")[];

const jakim = () => {
  const parameters = new CalculationParameters("Other", 18, 18);
  parameters.methodAdjustments = { fajr: 2, sunrise: -2, dhuhr: 3, asr: 2, maghrib: 2, isha: 2 };
  parameters.rounding = Rounding.Up;
  return parameters;
};

const RAMADAN_ISHA_MINUTES = 30;

const MINUTE_MS = 60_000;

const hijriMonth = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  month: "numeric",
  timeZone: "UTC",
});

export const prayerPlace = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  method: z
    .enum(METHODS)
    .describe(
      "The method the local authority or masjid uses: UmmAlQura in Saudi Arabia, Dubai in the UAE, Kuwait, Qatar, Turkey (Diyanet) in Turkey, Egyptian in Egypt and much of Africa and the Levant, Karachi in Pakistan, India, Bangladesh and Afghanistan, Malaysia (JAKIM) in Malaysia, Singapore in Singapore and Indonesia, Tehran in Iran, NorthAmerica (ISNA) or MoonsightingCommittee in the US and Canada, MoonsightingCommittee or MuslimWorldLeague in the UK, MuslimWorldLeague elsewhere in Europe and when unsure.",
    ),
  asr: z
    .enum(["standard", "hanafi"])
    .describe("hanafi when the user follows the Hanafi school, standard otherwise."),
});

export type PrayerPlace = z.infer<typeof prayerPlace>;

export function prayerTimesOn(
  { latitude, longitude, method, asr }: PrayerPlace,
  { year, month, day }: { year: number; month: number; day: number },
) {
  const coordinates = new Coordinates(latitude, longitude);
  const parameters = method === "Malaysia" ? jakim() : CalculationMethod[method]();
  parameters.madhab = asr === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  parameters.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  const date = new Date(year, month - 1, day);
  const times = new PrayerTimes(coordinates, date, parameters);
  const ramadanNight =
    method === "UmmAlQura" && hijriMonth.format(Date.UTC(year, month - 1, day + 1)) === "9";
  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: ramadanNight
      ? new Date(times.isha.getTime() + RAMADAN_ISHA_MINUTES * MINUTE_MS)
      : times.isha,
  } satisfies Record<(typeof PRAYERS)[number], Date>;
}
