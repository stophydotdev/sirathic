"use client";

import { useT } from "@/components/i18n";
import { chatData } from "@sirathic/server/messages";
import { useAuiState } from "@assistant-ui/react";
import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FC } from "react";

export const QuoteCheck: FC = () => {
  const t = useT();
  const part = useAuiState((s) =>
    s.message.content.find((content) => content.type === "data" && content.name === "quotes"),
  );
  const unmatched =
    part?.type === "data" ? chatData.quotes.safeParse(part.data).data?.unmatched : undefined;
  if (!unmatched?.length) return null;

  return (
    <details
      role="note"
      dir="auto"
      className="group my-3 border-s-2 border-amber-500/70 ps-3.5 text-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-amber-600 dark:text-amber-500 [&::-webkit-details-marker]:hidden">
        <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0" />
        {t("Check these quotes")}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="ms-auto size-3.5 shrink-0 -rotate-90 group-open:rotate-0 rtl:rotate-90 rtl:group-open:rotate-0"
        />
      </summary>
      <p className="text-foreground mt-1">
        {t(
          "These quotes don't match the sources word for word. Check them before you rely on them.",
        )}
      </p>
      <ul className="text-muted-foreground mt-1.5 flex flex-col gap-1">
        {unmatched.map((quote) => (
          <li key={quote} dir="auto">
            “{quote}”
          </li>
        ))}
      </ul>
    </details>
  );
};
