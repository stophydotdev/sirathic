"use client";

import { useT } from "@/components/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import type { FC } from "react";

export const MemoryFacts: FC<{
  memory: readonly string[];
  onChange: (next: readonly string[]) => void;
}> = ({ memory, onChange }) => {
  const t = useT();

  if (memory.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Nothing saved yet. Sirathic saves lasting facts you share in a chat.")}
      </p>
    );
  }

  return (
    <ul className="-my-1 flex max-h-[50dvh] flex-col overflow-y-auto">
      {memory.map((fact, index) => (
        <li
          key={fact}
          className="border-foreground/6 flex items-start gap-3 border-t py-2.5 first:border-t-0"
        >
          <span className="min-w-0 flex-1 text-sm break-words">{fact}</span>
          <button
            type="button"
            aria-label={t("Delete")}
            onClick={() => onChange(memory.filter((_, at) => at !== index))}
            className="text-muted-foreground hover:bg-muted hover:text-destructive flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-colors"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
};
