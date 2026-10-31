"use client";

import { useLocale, useT } from "@/components/i18n";
import { PRAYERS, prayerTimetable } from "@sirathic/server/cards";
import { type FC, useState } from "react";
import type { z } from "zod";

type Timetable = z.infer<typeof prayerTimetable>;

const PRAYER_NAMES = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
} as const;

const nowIn = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((found) => found.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
};

const nextPrayer = ({ days, timezone }: Timetable) => {
  const now = nowIn(timezone);
  const today = days[0];
  if (today?.date !== now.date) return undefined;
  return PRAYERS.find((prayer) => prayer !== "sunrise" && today[prayer] > now.time);
};

export const PrayerTimesCard: FC<{ result: unknown }> = ({ result }) => {
  const shown = prayerTimetable.safeParse(result).data;
  const [all, setAll] = useState(false);
  const t = useT();
  const locale = useLocale();
  if (!shown) return null;
  const [first] = shown.days;
  if (!first) return null;
  const next = nextPrayer(shown);
  const dateOf = (date: string, month: "long" | "short") =>
    new Intl.DateTimeFormat(locale, {
      weekday: month === "long" ? "long" : undefined,
      day: "numeric",
      month,
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

  return (
    <div className="bg-foreground/7 my-4 rounded-3xl p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-medium">{shown.place ?? t("Prayer times")}</p>
        <p className="text-muted-foreground shrink-0 text-sm">{dateOf(first.date, "long")}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PRAYERS.map((prayer) => (
          <div
            key={prayer}
            className={`${prayer === next ? "bg-foreground text-background" : "bg-background"} rounded-2xl px-3 py-2`}
          >
            <p className={`${prayer === next ? "" : "text-muted-foreground"} text-xs`}>
              {prayer === next ? t("Next prayer") : t(PRAYER_NAMES[prayer])}
            </p>
            <p className="text-lg font-medium tabular-nums">{first[prayer]}</p>
            {prayer === next && <p className="text-xs">{t(PRAYER_NAMES[prayer])}</p>}
          </div>
        ))}
      </div>
      {shown.days.length > 1 && (
        <>
          {all && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-muted-foreground text-start">
                    <th className="py-1 pe-3 text-start font-normal" />
                    {PRAYERS.map((prayer) => (
                      <th key={prayer} className="px-2 py-1 text-start font-normal">
                        {t(PRAYER_NAMES[prayer])}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.days.map((day) => (
                    <tr key={day.date} className="border-foreground/10 border-t">
                      <td className="text-muted-foreground py-1 pe-3 whitespace-nowrap">
                        {dateOf(day.date, "short")}
                      </td>
                      {PRAYERS.map((prayer) => (
                        <td key={prayer} className="px-2 py-1">
                          {day[prayer]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAll(!all)}
            className="text-muted-foreground hover:text-foreground mt-3 text-sm print:hidden"
          >
            {all ? t("Hide") : t("All {count} days", { count: shown.days.length })}
          </button>
        </>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        {t("Calculated times. Your masjid's times can differ.")}
      </p>
    </div>
  );
};
