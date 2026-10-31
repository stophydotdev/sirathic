"use client";

import { useLocale, useT } from "@/components/i18n";
import { islamicDays } from "@sirathic/server/cards";
import type { FC } from "react";

const DAY_MS = 86_400_000;

const atNoon = (date: string) => new Date(`${date}T12:00:00Z`);

export const IslamicDatesCard: FC<{ result: unknown }> = ({ result }) => {
  const shown = islamicDays.safeParse(result).data;
  const t = useT();
  const locale = useLocale();
  if (!shown) return null;
  const hijri = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const gregorian = (weekday: "long" | "short") =>
    new Intl.DateTimeFormat(locale, {
      weekday,
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const today = atNoon(new Date().toLocaleDateString("en-CA"));
  const daysUntil = (date: string) =>
    Math.round((atNoon(date).getTime() - today.getTime()) / DAY_MS);

  return (
    <div className="bg-foreground/7 my-4 rounded-3xl p-4">
      <p className="text-lg font-medium">{hijri.format(atNoon(shown.gregorian))}</p>
      <p className="text-muted-foreground text-sm">
        {gregorian("long").format(atNoon(shown.gregorian))}
      </p>
      {shown.upcoming.length > 0 && (
        <div className="divide-foreground/10 bg-background mt-3 flex flex-col divide-y rounded-2xl px-3">
          {shown.upcoming.map((event) => (
            <div key={event.name} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{t(event.name)}</p>
                <p className="text-muted-foreground text-sm">
                  {gregorian("short").format(atNoon(event.gregorian))}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-sm">
                {relative.format(daysUntil(event.gregorian), "day")}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        {t("Expected dates. A month can start a day earlier or later where the moon is sighted.")}
      </p>
    </div>
  );
};
