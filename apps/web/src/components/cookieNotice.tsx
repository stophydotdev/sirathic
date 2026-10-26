"use client";

import { useT } from "@/components/i18n";
import Link from "next/link";
import { type FC, useEffect, useState } from "react";

const SEEN_KEY = "sirathicCookieNotice";
const link = "text-foreground text-[13px] font-medium underline underline-offset-2";

export const CookieNotice: FC = () => {
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => setOpen(!globalThis.localStorage?.getItem(SEEN_KEY)), []);
  if (!open) return null;

  return (
    <div className="bg-background border-foreground/12 fixed end-4 bottom-4 z-50 w-[528px] max-w-[calc(100vw-2rem)] rounded-[16px] border px-4 py-3.5 text-[15px] leading-[22.5px] print:hidden">
      <p className="text-muted-foreground">
        {t("Sirathic uses only essential cookies to keep you signed in.")}{" "}
        <Link href="/privacy" className={link}>
          {t("Privacy")}
        </Link>
        {", "}
        <Link href="/terms" className={link}>
          {t("Terms")}
        </Link>
      </p>
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={() => {
            globalThis.localStorage?.setItem(SEEN_KEY, "1");
            setOpen(false);
          }}
          className="bg-foreground text-background h-[29px] rounded-full px-3 text-sm font-medium transition hover:opacity-85"
        >
          {t("Got it")}
        </button>
      </div>
    </div>
  );
};
