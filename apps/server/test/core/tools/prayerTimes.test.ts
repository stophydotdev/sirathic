import { expect, test } from "bun:test";
import { prayerTimes } from "@sirathic/core/tools/prayerTimes";

const makkah = {
  latitude: 21.4225,
  longitude: 39.8262,
  timezone: "Asia/Riyadh",
  method: "umm_al_qura",
} as const;

const clock = (result: ReturnType<typeof prayerTimes>) =>
  Object.entries(result.times).map(([name, entry]) => [name, entry?.time]);

const minutes = (time: string | undefined) => {
  const [hours, mins] = (time ?? "0:0").split(":").map(Number);
  return hours * 60 + mins;
};

const ishaGapAfterMaghrib = (date: string) => {
  const { times } = prayerTimes({ ...makkah, date });
  return minutes(times.isha?.time) - minutes(times.maghrib?.time);
};

const londonAsr = (asrSchool: "shafii" | "hanafi") =>
  prayerTimes({
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: "Europe/London",
    date: "2026-10-15",
    asrSchool,
  }).times.asr?.time;

const nextAt = (instant: string) =>
  prayerTimes({ ...makkah, date: "2026-10-15" }, new Date(instant)).next;

test("Makkah times with Umm al-Qura match the aladhan.com reference", () => {
  expect(clock(prayerTimes({ ...makkah, date: "2026-10-15" }))).toEqual([
    ["fajr", "05:00"],
    ["sunrise", "06:16"],
    ["dhuhr", "12:06"],
    ["asr", "15:27"],
    ["maghrib", "17:56"],
    ["isha", "19:26"],
  ]);
});

test("Umm al-Qura sets Isha 120 minutes after Maghrib in Ramadan and 90 otherwise", () => {
  expect(ishaGapAfterMaghrib("2027-02-20")).toBe(120);
  expect(ishaGapAfterMaghrib("2027-01-20")).toBe(90);
});

test("the Hanafi school gives a later Asr", () => {
  expect(londonAsr("shafii")).toBe("15:31");
  expect(londonAsr("hanafi")).toBe("16:15");
});

test("the next prayer is the first one still ahead, and after Isha it is tomorrow's Fajr", () => {
  expect(nextAt("2026-10-15T10:00:00Z")?.prayer).toBe("asr");
  expect(nextAt("2026-10-15T19:00:00Z")).toMatchObject({
    prayer: "fajr",
    date: "2026-10-16",
  });
});

test("a date other than today has no next prayer", () => {
  expect(
    prayerTimes(
      { ...makkah, date: "2026-10-20" },
      new Date("2026-10-15T09:00:00Z"),
    ).next,
  ).toBeNull();
});
