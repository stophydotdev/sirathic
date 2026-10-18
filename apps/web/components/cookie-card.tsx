"use client";

import type { MessageKey } from "@/messages/en";
import { useT } from "@/components/i18n";
import { useAccount } from "@/components/account";
import { Cookie } from "lucide-react";
import { type FC, useEffect, useState } from "react";

const COOKIE_KEY = "sirathicCookies";
const CHOICES = [
  { value: "all", label: "Allow all" },
  { value: "necessary", label: "Reject" },
] satisfies readonly { value: string; label: MessageKey }[];

export const CookieCard: FC = () => {
  const [shown, setShown] = useState(false);
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const t = useT();

  useEffect(() => {
    setShown(globalThis.localStorage?.getItem(COOKIE_KEY) == null);
  }, []);

  if (!shown || !signedOut) return null;

  return (
    <section
      aria-labelledby="cookie-title"
      className="bg-card border-border fixed end-3 bottom-3 z-50 flex w-[446px] max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-[12px] border px-5 pt-[18px] pb-4"
    >
      <h2
        id="cookie-title"
        className="flex items-center gap-2.5 text-[17px] font-[470]"
      >
        <Cookie className="size-[18px]" />
        {t("Cookie Policy")}
      </h2>
      <p className="text-muted-foreground text-[15px] leading-[22px]">
        {t(
          "Sirathic only uses what it needs to work: your settings and your sign-in. No ads, no tracking, nothing sold.",
        )}
      </p>
      <div className="mt-2 flex gap-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => {
              globalThis.localStorage?.setItem(COOKIE_KEY, choice.value);
              setShown(false);
            }}
            className="bg-foreground/8 hover:bg-foreground/12 h-9 rounded-[8px] px-3.5 text-[15px] font-[470] transition-colors"
          >
            {t(choice.label)}
          </button>
        ))}
      </div>
    </section>
  );
};
