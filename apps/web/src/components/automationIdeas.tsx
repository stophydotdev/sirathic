"use client";

import { blankDraft, type Draft } from "@/components/automationDraft";
import { type Translate, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Baby01Icon,
  Book04Icon,
  Bookmark02Icon,
  Books01Icon,
  CampfireIcon,
  JusticeScale01Icon,
  LanguageSkillIcon,
  Moon02Icon,
  Mosque01Icon,
  PrayerRugIcon,
  SunriseIcon,
  SunsetIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { FC } from "react";

const templateGroups = (t: Translate) =>
  [
    {
      title: t("Daily"),
      tile: "bg-sky-500",
      templates: [
        {
          icon: Book04Icon,
          name: t("Daily hadith"),
          prompt: t("Share one authentic hadith with its grading and a short explanation."),
          schedule: { kind: "daily", time: "06:00" },
        },
        {
          icon: SunriseIcon,
          name: t("Morning adhkar"),
          prompt: t("Give me the morning adhkar with their sources and when to say them."),
          schedule: { kind: "daily", time: "05:30" },
        },
        {
          icon: SunsetIcon,
          name: t("Evening adhkar"),
          prompt: t("Give me the evening adhkar with their sources and when to say them."),
          schedule: { kind: "daily", time: "17:30" },
        },
        {
          icon: Bookmark02Icon,
          name: t("Verse of the day"),
          prompt: t("Share one verse of the Quran with its translation and a short tafsir."),
          schedule: { kind: "daily", time: "07:00" },
        },
      ],
    },
    {
      title: t("Learning"),
      tile: "bg-violet-500",
      templates: [
        {
          icon: Books01Icon,
          name: t("Weekly tafsir"),
          prompt: t("Explain a few verses of a short surah from the classical tafsir books."),
          schedule: { kind: "weekly", days: [0], time: "09:00" },
        },
        {
          icon: LanguageSkillIcon,
          name: t("Quran word of the day"),
          prompt: t("Teach me one Arabic word from the Quran with its root and a verse using it."),
          schedule: { kind: "daily", time: "08:00" },
        },
        {
          icon: CampfireIcon,
          name: t("Seerah story"),
          prompt: t("Tell me one story from the seerah of the Prophet ﷺ, with a lesson to take."),
          schedule: { kind: "weekly", days: [6], time: "10:00" },
        },
        {
          icon: JusticeScale01Icon,
          name: t("Fiqh question explained"),
          prompt: t("Explain one everyday fiqh question with the view of each madhhab."),
          schedule: { kind: "weekly", days: [3], time: "20:00" },
        },
      ],
    },
    {
      title: t("Worship"),
      tile: "bg-emerald-600",
      templates: [
        {
          icon: Mosque01Icon,
          name: t("Friday reminder"),
          prompt: t("Remind me of the sunnah of Friday with one relevant hadith."),
          schedule: { kind: "weekly", days: [5], time: "11:00" },
        },
        {
          icon: Moon02Icon,
          name: t("Monday and Thursday fast"),
          prompt: t("Remind me that tomorrow is a sunnah fast day, with a hadith on its reward."),
          schedule: { kind: "weekly", days: [0, 3], time: "20:00" },
        },
        {
          icon: PrayerRugIcon,
          name: t("Nightly dua"),
          prompt: t("Give me one authentic dua for the night with its meaning and source."),
          schedule: { kind: "daily", time: "21:30" },
        },
      ],
    },
    {
      title: t("Family"),
      tile: "bg-amber-500",
      templates: [
        {
          icon: Baby01Icon,
          name: t("Prophet story for kids"),
          prompt: t("Tell a short story of a prophet for children, in simple words."),
          schedule: { kind: "daily", time: "19:30" },
        },
        {
          icon: UserGroupIcon,
          name: t("Family halaqa"),
          prompt: t("Suggest a topic for our family halaqa, with a verse, a hadith and questions."),
          schedule: { kind: "weekly", days: [5], time: "18:00" },
        },
      ],
    },
  ] as const;

const pillButton =
  "h-8 shrink-0 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50";

export const AutomationIdeas: FC<{ onAdd: (draft: Draft) => void }> = ({ onAdd }) => {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      {templateGroups(t).map(({ title, tile, templates }) => (
        <section key={title}>
          <h2 className="mb-2 px-2 text-base font-medium">{title}</h2>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {templates.map(({ icon: Icon, name, prompt, schedule }) => (
              <div
                key={name}
                className="rise hover:bg-muted/50 flex min-h-16 min-w-0 items-center gap-3 rounded-xl p-2"
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl text-white",
                    tile,
                  )}
                >
                  <HugeiconsIcon icon={Icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-muted-foreground line-clamp-2 text-sm">{prompt}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onAdd({
                      ...blankDraft(),
                      name,
                      prompt,
                      kind: schedule.kind,
                      time: schedule.time,
                      days: schedule.kind === "weekly" ? [...schedule.days] : [1],
                    })
                  }
                  className={cn(pillButton, "bg-muted hover:bg-foreground/10")}
                >
                  {t("Add")}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
