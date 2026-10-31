"use client";

import { useT } from "@/components/i18n";
import { useAui, useAuiState } from "@assistant-ui/react";
import type { FC } from "react";

const SUGGESTIONS = ["Check its verses and hadith", "Summarize it", "Translate it"] as const;

export const FileSuggestions: FC = () => {
  const aui = useAui();
  const shown = useAuiState(
    (s) =>
      s.composer.attachments.length > 0 && s.composer.text.trim() === "" && !s.thread.isRunning,
  );
  const t = useT();
  if (!shown) return null;
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => {
            const composer = aui.thread().composer();
            composer.setText(t(suggestion));
            composer.send();
          }}
          className="bg-foreground/7 hover:bg-foreground/12 h-8 rounded-full px-3 text-sm"
        >
          {t(suggestion)}
        </button>
      ))}
    </div>
  );
};
