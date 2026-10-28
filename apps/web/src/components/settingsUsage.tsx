"use client";

import { type Translate, useLocale, useT } from "@/components/i18n";
import { Group } from "@/components/settingsControls";
import { api } from "@/lib/trpc";
import { type FC, useEffect, useState } from "react";

export type Usage = Awaited<ReturnType<typeof api.account.usage.query>>;
type Window = Usage["noor"][number];

export const WEEK_SECONDS = 604_800;
const DAY_MS = 86_400_000;

const limitName = (t: Translate, seconds: number) =>
  seconds === WEEK_SECONDS
    ? t("Weekly limit")
    : t("{hours}-hour limit", { hours: Math.round(seconds / 3600) });

export const resetTime = (resetAt: number, locale: string) =>
  new Intl.DateTimeFormat(
    locale,
    resetAt - Date.now() < DAY_MS
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", month: "short", day: "numeric" },
  ).format(resetAt);

const Windows: FC<{ windows: readonly Window[] }> = ({ windows }) => {
  const locale = useLocale();
  const t = useT();
  return windows.map((window) => (
    <div key={window.seconds} className="flex flex-col gap-1.5 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{limitName(t, window.seconds)}</span>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {t("{percent}% used", { percent: Math.round(window.usedPercent) })}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-super h-full rounded-full"
          style={{ width: `${Math.min(100, window.usedPercent)}%` }}
        />
      </div>
      {window.resetAt !== null && (
        <span className="text-muted-foreground text-[13px]">
          {t("Resets {time}", { time: resetTime(window.resetAt, locale) })}
        </span>
      )}
    </div>
  ));
};

export const UsageGroup: FC = () => {
  const [usage, setUsage] = useState<Usage>();
  const t = useT();

  useEffect(() => {
    void api.account.usage.query().then(setUsage, () => undefined);
  }, []);

  if (!usage) return null;
  return (
    <Group title={t("Usage")}>
      <div className="py-2 text-sm font-medium">Noor 1 Flash</div>
      <Windows windows={usage.noor} />
      {usage.chatgpt && (
        <>
          <div className="flex items-center gap-2 py-2">
            <span className="text-sm font-medium">
              ChatGPT {usage.chatgpt.plan.charAt(0).toUpperCase() + usage.chatgpt.plan.slice(1)}
            </span>
            <span className="text-super border-foreground/10 rounded-full border px-2 text-xs">
              {t("GPT answers")}
            </span>
          </div>
          <Windows windows={usage.chatgpt.windows} />
        </>
      )}
    </Group>
  );
};
