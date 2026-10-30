import { expect, test } from "bun:test";
import { nextRun, type Schedule } from "../apps/server/src/automations/schedule";
import { PRAYERS, prayerTimesOn, type PrayerPlace } from "../apps/server/src/prayer/times";

const MINUTE_MS = 60_000;

const minutesIn = (zone: string, instant: Date) => {
  const [hour = 0, minute = 0] = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(instant)
    .split(":")
    .map(Number);
  return hour * 60 + minute;
};

const official = [
  {
    authority: "JAKIM, Kuala Lumpur (WLY01)",
    place: { latitude: 3.139, longitude: 101.6869, method: "Malaysia", asr: "standard" },
    zone: "Asia/Kuala_Lumpur",
    date: { year: 2026, month: 10, day: 30 },
    times: ["05:48", "06:56", "13:00", "16:19", "18:59", "20:09"],
  },
  {
    authority: "Diyanet, Istanbul",
    place: { latitude: 41.0082, longitude: 28.9784, method: "Turkey", asr: "standard" },
    zone: "Europe/Istanbul",
    date: { year: 2026, month: 10, day: 30 },
    times: ["05:59", "07:25", "12:53", "15:43", "18:10", "19:31"],
  },
  {
    authority: "MUIS, Singapore",
    place: { latitude: 1.3521, longitude: 103.8198, method: "Singapore", asr: "standard" },
    zone: "Asia/Singapore",
    date: { year: 2025, month: 1, day: 1 },
    times: ["05:43", "07:07", "13:09", "16:33", "19:10", "20:25"],
  },
] satisfies {
  authority: string;
  place: PrayerPlace;
  zone: string;
  date: { year: number; month: number; day: number };
  times: string[];
}[];

test.each(official)("prayer times are within two minutes of $authority", (row) => {
  const times = prayerTimesOn(row.place, row.date);
  const gaps = PRAYERS.map((prayer, index) => {
    const [hour = 0, minute = 0] = (row.times[index] ?? "").split(":").map(Number);
    return Math.abs(minutesIn(row.zone, times[prayer]) - (hour * 60 + minute));
  });
  expect(Math.max(...gaps)).toBeLessThanOrEqual(2);
});

test("Umm al-Qura Isha moves to two hours after Maghrib from the first night of Ramadan", () => {
  const makkah = {
    latitude: 21.4225,
    longitude: 39.8262,
    method: "UmmAlQura",
    asr: "standard",
  } satisfies PrayerPlace;
  const gap = (day: number) => {
    const times = prayerTimesOn(makkah, { year: 2026, month: 2, day });
    return (times.isha.getTime() - times.maghrib.getTime()) / MINUTE_MS;
  };
  expect(gap(16)).toBe(90);
  expect(gap(17)).toBe(120);
  expect(gap(18)).toBe(120);
});

test("a routine tied to a prayer moves with it every day, even past midnight", () => {
  const london = {
    latitude: 51.5074,
    longitude: -0.1278,
    method: "MuslimWorldLeague",
    asr: "standard",
  } satisfies PrayerPlace;
  const zone = "Europe/London";
  const beforeMaghrib: Schedule = {
    kind: "daily",
    time: "16:22",
    prayer: { ...london, name: "maghrib", minutes: -15 },
  };
  expect(nextRun(beforeMaghrib, zone, new Date("2026-10-30T12:00:00Z"))?.toISOString()).toBe(
    "2026-10-30T16:22:00.000Z",
  );
  expect(nextRun(beforeMaghrib, zone, new Date("2026-10-30T16:30:00Z"))?.toISOString()).toBe(
    "2026-10-31T16:20:00.000Z",
  );
  const afterIsha: Schedule = {
    kind: "daily",
    time: "00:25",
    prayer: { ...london, name: "isha", minutes: 120 },
  };
  const run =
    prayerTimesOn(london, { year: 2026, month: 6, day: 21 }).isha.getTime() + 120 * MINUTE_MS;
  expect(minutesIn(zone, new Date(run))).toBeLessThan(60);
  expect(nextRun(afterIsha, zone, new Date("2026-06-21T23:01:00Z"))?.getTime()).toBe(run);
});
