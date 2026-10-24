"use client";

import { Favicon } from "@/components/favicon";
import type { Source } from "@sirathic/server/sources";
import type { FC } from "react";

export const SourceRow: FC<{ sources: Source[] }> = ({ sources }) => {
  if (sources.length === 0) return null;

  return (
    <div className="not-prose mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] print:hidden">
      {sources.map((source, index) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="bg-muted hover:bg-foreground/10 flex min-w-40 flex-1 basis-0 flex-col gap-1 rounded-xl px-3 py-2 no-underline! transition-colors"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-[470]">
            <span className="bg-foreground/10 text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded text-[10px] tabular-nums">
              {index + 1}
            </span>
            <Favicon url={source.url} size={12} />
            <span className="truncate">{source.title}</span>
          </span>
          <span dir="auto" className="text-muted-foreground line-clamp-2 text-xs leading-snug">
            {source.snippet}
          </span>
        </a>
      ))}
    </div>
  );
};
