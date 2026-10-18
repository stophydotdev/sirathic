import { expect, test } from "bun:test";
import { islamicCalendar } from "@sirathic/core/tools/islamicCalendar";

const datesOf = (input: Parameters<typeof islamicCalendar>[0]) =>
  islamicCalendar(input).events.map(
    (event) => `${event.id} ${event.gregorian.date}`,
  );

test("a Gregorian year lists the events that fall inside it, in date order", () => {
  expect(datesOf({ year: 2027 })).toEqual([
    "ramadan_start 2027-02-08",
    "eid_al_fitr 2027-03-09",
    "day_of_arafah 2027-05-15",
    "eid_al_adha 2027-05-16",
    "islamic_new_year 2027-06-06",
    "ashura 2027-06-15",
  ]);
});

test("a year can hold the Islamic New Year twice", () => {
  expect(
    datesOf({ year: 2008 }).filter((line) =>
      line.startsWith("islamic_new_year"),
    ),
  ).toEqual(["islamic_new_year 2008-01-10", "islamic_new_year 2008-12-29"]);
});

test("a Hijri year lists its own events", () => {
  expect(datesOf({ year: 1448, calendar: "hijri" })).toEqual([
    "islamic_new_year 2026-06-16",
    "ashura 2026-06-25",
    "ramadan_start 2027-02-08",
    "eid_al_fitr 2027-03-09",
    "day_of_arafah 2027-05-15",
    "eid_al_adha 2027-05-16",
  ]);
});

test("a year outside the calendar's table is rejected", () => {
  expect(() => islamicCalendar({ year: 1448 })).toThrow("between");
});
