"use client";

import { TINTS } from "@/components/discoverArticle";
import { useLocale, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { type FC, useSyncExternalStore } from "react";

const BOX = "border-border flex flex-col gap-2.5 rounded-2xl border p-4";
const MONTHS_AHEAD = 4;
const SCAN_DAYS = 130;
const HIJRI_DAY = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric" });

const subscribeNever = () => () => {};
const todayOf = () => new Date().toDateString();

const ComingUp: FC = () => {
  const t = useT();
  const locale = useLocale();
  const today = useSyncExternalStore(subscribeNever, todayOf, () => undefined);
  if (!today) return null;

  const now = new Date(today);
  const starts = Array.from(
    { length: SCAN_DAYS },
    (_, index) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + index + 1, 12),
  )
    .filter((day) => HIJRI_DAY.format(day) === "1")
    .slice(0, MONTHS_AHEAD);
  const calendar = `${locale}-u-ca-islamic-umalqura`;
  const hijri = new Intl.DateTimeFormat(calendar, { dateStyle: "long" });
  const month = new Intl.DateTimeFormat(calendar, { month: "long" });
  const gregorian = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <section
      className={cn(
        "star-pattern flex flex-col gap-2.5 overflow-hidden rounded-2xl bg-linear-to-br p-4 text-white",
        TINTS.indigo.cover,
      )}
    >
      <h2 className="font-serif text-xl">{hijri.format(now)}</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {starts.map((day) => (
          <li key={day.getTime()} className="flex justify-between gap-3">
            <span>{month.format(day)}</span>
            <span className="text-white/70">{gregorian.format(day)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-white/70">
        {t("Umm al-Qura dates. Moon sighting can differ by a day.")}
      </p>
    </section>
  );
};

export const DiscoverRail: FC = () => {
  const t = useT();
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 lg:flex">
      <section className={BOX}>
        <h2 className="text-sm font-medium">{t("How Discover works")}</h2>
        <p className="text-muted-foreground text-sm">
          {t(
            "Disputed questions, answered from the Quran, hadith and fiqh books with every source cited.",
          )}
        </p>
      </section>
      <ComingUp />
    </aside>
  );
};
