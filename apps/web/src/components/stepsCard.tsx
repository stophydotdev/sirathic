"use client";

import { useT } from "@/components/i18n";
import { steps as stepsSchema } from "@sirathic/server/cards";
import { type FC, useState } from "react";

const pill =
  "bg-foreground/8 hover:bg-foreground/12 h-8 rounded-full px-3 text-sm font-medium disabled:opacity-40";

const Number: FC<{ at: number }> = ({ at }) => (
  <span className="bg-foreground text-background inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
    {at + 1}
  </span>
);

export const StepsCard: FC<{ args: unknown }> = ({ args }) => {
  const shown = stepsSchema.safeParse(args).data;
  const [at, setAt] = useState(0);
  const [all, setAll] = useState(shown?.view === "list");
  const t = useT();
  if (!shown) return null;
  const step = shown.steps[at];

  return (
    <div className="bg-foreground/7 my-4 rounded-3xl p-4 print:hidden">
      <div className="text-muted-foreground mb-3 flex items-center justify-between text-sm">
        <span>
          {all
            ? t("{count} steps", { count: shown.steps.length })
            : t("Step {at} of {count}", { at: at + 1, count: shown.steps.length })}
        </span>
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="hover:text-foreground rounded-md px-1"
        >
          {all ? t("One at a time") : t("Show all")}
        </button>
      </div>
      {all ? (
        <ol className="flex flex-col gap-4">
          {shown.steps.map((item, index) => (
            <li key={item.title} className="flex gap-3">
              <Number at={index} />
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        step && (
          <>
            <div className="flex min-h-24 gap-3">
              <Number at={at} />
              <div className="min-w-0">
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={at === 0}
                onClick={() => setAt(at - 1)}
                className={pill}
              >
                {t("Back")}
              </button>
              {at < shown.steps.length - 1 ? (
                <button type="button" onClick={() => setAt(at + 1)} className={pill}>
                  {t("Next")}
                </button>
              ) : (
                <button type="button" onClick={() => setAll(true)} className={pill}>
                  {t("Show all")}
                </button>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};
