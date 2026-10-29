"use client";

import { useAccount } from "@/components/account";
import { useChatState, useResumeAt } from "@/components/chat";
import { useLocale, useT } from "@/components/i18n";
import { useSettings } from "@/components/settings";
import { resetTime, type Usage, WEEK_SECONDS } from "@/components/settingsUsage";
import { useSignIn } from "@/components/signIn";
import { api } from "@/lib/trpc";
import { type FC, useEffect, useState } from "react";

const WARN_PERCENT = 80;

export const NoorLimitLine: FC<{ running: boolean }> = ({ running }) => {
  const [windows, setWindows] = useState<Usage["noor"]>([]);
  const show = useSettings((s) => s.show);
  const onChatGpt = useAccount((s) => s.status?.signedIn === true && s.status.via === "chatgpt");
  const ask = useSignIn((s) => s.ask);
  const locale = useLocale();
  const t = useT();
  const resuming = useResumeAt(useChatState()?.id) !== undefined;

  useEffect(() => {
    if (running) return;
    void api.account.usage.query().then(
      ({ noor }) => setWindows(noor),
      () => undefined,
    );
  }, [running]);

  const fullest =
    windows.findLast((window) => window.usedPercent >= 100 && window.resetAt !== null) ??
    windows.findLast((window) => window.usedPercent >= WARN_PERCENT && window.resetAt !== null);
  if (!fullest?.resetAt) return null;
  const time = resetTime(fullest.resetAt, locale);
  const week = fullest.seconds === WEEK_SECONDS;
  const percent = Math.round(fullest.usedPercent);
  const line =
    percent >= 100
      ? week
        ? t("You've used this week's Noor limit. It resets {time}.", { time })
        : t("You've used Noor's limit for now. It resets at {time}.", { time })
      : week
        ? t("You've used {percent}% of this week's Noor limit. Resets {time}.", { percent, time })
        : t("You've used {percent}% of Noor's limit for now. Resets {time}.", { percent, time });
  const wayOut = percent >= 100 && !onChatGpt;
  return (
    <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 px-3 pb-2 text-xs">
      <span>
        {line}
        {percent >= 100 && resuming && ` ${t("Your question sends by itself then.")}`}
        {wayOut && ` ${t("Sign in with ChatGPT to keep asking with GPT.")}`}
      </span>
      {wayOut && (
        <button type="button" className="text-super shrink-0" onClick={() => ask()}>
          {t("Continue with ChatGPT")}
        </button>
      )}
      <button type="button" className="text-super shrink-0" onClick={() => show("account")}>
        {t("Usage")} →
      </button>
    </div>
  );
};
