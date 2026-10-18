import { expect, test } from "bun:test";
import { hijriDate } from "@sirathic/core/tools/hijriDate";

test("a Gregorian date converts to its Umm al-Qura Hijri date", () => {
  const result = hijriDate({ date: "2027-02-08" });
  expect(result.hijri).toMatchObject({
    year: 1448,
    month: 9,
    day: 1,
    text: "1 Ramadan 1448 AH",
  });
  expect(result.gregorian.weekday).toBe("Monday");
});

test("a Hijri date converts back to Gregorian", () => {
  expect(
    hijriDate({ hijri: { year: 1448, month: 12, day: 10 } }).gregorian.date,
  ).toBe("2027-05-16");
});

test("a day that the month does not have is rejected", () => {
  expect(() => hijriDate({ hijri: { year: 1448, month: 9, day: 30 } })).toThrow(
    "does not exist",
  );
});

test("today is read in the caller's time zone", () => {
  const justBeforeMidnightUtc = new Date("2026-10-14T23:30:00Z");
  expect(
    hijriDate({ timezone: "UTC" }, justBeforeMidnightUtc).gregorian.date,
  ).toBe("2026-10-14");
  expect(
    hijriDate({ timezone: "Asia/Riyadh" }, justBeforeMidnightUtc).gregorian
      .date,
  ).toBe("2026-10-15");
});
