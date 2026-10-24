"use client";

import { useT } from "@/components/i18n";
import { CONSENT_KEY, setAnalyticsConsent } from "@/lib/analytics";
import { type FC, useEffect } from "react";
import { create } from "zustand";

type Choice = "granted" | "denied";

const savedChoice = (): Choice | undefined => {
  try {
    const saved = localStorage.getItem(CONSENT_KEY);
    return saved === "granted" || saved === "denied" ? saved : undefined;
  } catch {
    return undefined;
  }
};

export const useConsent = create<{
  open: boolean;
  load: () => void;
  choose: (granted: boolean) => void;
  reopen: () => void;
}>()((set) => ({
  open: false,
  load: () => set({ open: savedChoice() === undefined }),
  choose: (granted) => {
    try {
      localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    } catch {}
    setAnalyticsConsent(granted);
    set({ open: false });
  },
  reopen: () => set({ open: true }),
}));

const button = "h-8 flex-1 rounded-[8px] text-sm font-[470] transition-colors";

export const CookieNotice: FC = () => {
  const open = useConsent((s) => s.open);
  const choose = useConsent((s) => s.choose);
  const t = useT();

  useEffect(() => useConsent.getState().load(), []);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label={t("Cookies")}
      className="bg-card ring-foreground/10 fixed start-3 bottom-[148px] z-50 flex w-[min(320px,calc(100vw-1.5rem))] flex-col gap-3 rounded-[14px] p-4 shadow-lg ring-1 lg:start-3 lg:bottom-3 print:hidden"
    >
      <p className="text-sm leading-5">
        {t(
          "Can we use Google Analytics cookies to see which features help? We never send your questions.",
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose(false)}
          className={`${button} bg-muted hover:bg-foreground/10`}
        >
          {t("No thanks")}
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className={`${button} bg-muted hover:bg-foreground/10`}
        >
          {t("Allow")}
        </button>
      </div>
    </div>
  );
};
