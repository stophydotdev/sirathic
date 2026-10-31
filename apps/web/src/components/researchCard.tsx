"use client";

import { useChatOptions } from "@/components/chatOptions";
import { useT } from "@/components/i18n";
import { chatData } from "@sirathic/server/messages";
import { useAui, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import type { FC } from "react";

export const ResearchCard: FC = () => {
  const aui = useAui();
  const last = useAuiState((s) => s.message.isLast);
  const running = useAuiState((s) => s.thread.isRunning);
  const rationale = useAuiState((s) =>
    s.message.content
      .map((part) =>
        part.type === "data" && part.name === "research"
          ? chatData.research.safeParse(part.data).data?.rationale
          : undefined,
      )
      .find(Boolean),
  );
  const t = useT();
  if (!rationale || !last) return null;

  return (
    <div className="border-foreground/10 my-4 flex flex-col items-start gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center print:hidden">
      <p className="text-muted-foreground min-w-0 text-sm sm:flex-1">{rationale}</p>
      <button
        type="button"
        disabled={running}
        onClick={() => {
          useChatOptions.getState().setOverride({ mode: "research" });
          aui.message().reload();
        }}
        className="bg-foreground text-background inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium disabled:opacity-50"
      >
        <HugeiconsIcon icon={Search01Icon} className="size-4" />
        {t("Research this")}
      </button>
    </div>
  );
};
