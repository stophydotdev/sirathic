"use client";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const APPROVAL_DOCK = "approval-dock";

export type ApprovalAnswer = "always" | "once" | "never";

const button = "h-8 rounded-lg px-3 text-xs font-medium disabled:opacity-50";

export const DetailRows: FC<{ rows: readonly (readonly [string, ReactNode])[] }> = ({ rows }) => (
  <dl className="border-foreground/12 bg-background divide-foreground/10 grid grid-cols-[auto_1fr] divide-y overflow-hidden rounded-lg border text-sm">
    {rows.map(([label, value]) => (
      <div key={label} className="col-span-2 grid grid-cols-subgrid">
        <dt className="text-muted-foreground px-3 py-1.5">{label}</dt>
        <dd className="min-w-0 px-3 py-1.5 wrap-break-word whitespace-pre-line">{value}</dd>
      </div>
    ))}
  </dl>
);

export const ApprovalPrompt: FC<{
  question: string;
  note?: string;
  always?: string;
  busy: boolean;
  onAnswer: (answer: ApprovalAnswer) => void;
  children: ReactNode;
}> = ({ question, note, always, busy, onAnswer, children }) => {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  useEffect(() => setDock(document.getElementById(APPROVAL_DOCK)), []);

  const prompt = (
    <section
      aria-label={question}
      className="border-foreground/12 bg-card flex w-full flex-col gap-2 rounded-xl border p-3 text-sm print:hidden"
    >
      <div className="flex gap-2">
        <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{question}</span>
          {note && <span className="text-muted-foreground text-xs">{note}</span>}
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-xs"
      >
        <HugeiconsIcon icon={ArrowDown01Icon} className={cn("size-3", !open && "-rotate-90")} />
        {open ? t("Hide details") : t("Show details")}
      </button>
      {open && children}
      <div className="flex flex-wrap gap-1.5">
        {always && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer("always")}
            className={cn(button, "border-foreground/14 hover:bg-foreground/6 border")}
          >
            {always}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer("once")}
          className={cn(button, "bg-foreground text-background")}
        >
          {t("Allow once")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer("never")}
          className={cn(button, "border-foreground/14 hover:bg-foreground/6 border")}
        >
          {t("Don't allow")}
        </button>
      </div>
    </section>
  );

  return dock ? createPortal(prompt, dock) : prompt;
};
