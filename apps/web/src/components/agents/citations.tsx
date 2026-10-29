"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, useId, useState } from "react";
import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { useFavicon } from "@/lib/hooks/useFavicon";
import { cn } from "@/lib/utils";

export interface CitationItem {
  id: string;
  title: ReactNode;
  domain?: ReactNode;
  url?: string;
  icon?: ReactNode;
  group?: string;
  snippet?: string;
}

export interface CitationListProps {
  citations: CitationItem[];
  idPrefix?: string;
  className?: string;
}

export interface CitationStackProps {
  citations: CitationItem[];
  limit?: number;
  className?: string;
}

function citationTargetId(prefix: string, citationId: string) {
  return `${prefix}-${citationId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function CitationFavicon({
  url,
  icon,
  className,
}: {
  url?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const favicon = useFavicon(icon ? undefined : url);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center text-muted-foreground [&>svg]:size-3.5",
        className,
      )}
    >
      {icon ? (
        icon
      ) : favicon.src ? (
        <img
          ref={favicon.ref}
          src={favicon.src}
          alt=""
          width={16}
          height={16}
          referrerPolicy="no-referrer"
          className="size-4 rounded-sm object-contain"
        />
      ) : (
        <HugeiconsIcon icon={Globe02Icon} className="size-3.5" />
      )}
    </span>
  );
}

export function CitationStack({ citations, limit = 3, className }: CitationStackProps) {
  return (
    <span aria-hidden="true" className={cn("flex -space-x-1.5", className)}>
      {citations.slice(0, limit).map((citation) => (
        <CitationFavicon
          key={citation.id}
          url={citation.url}
          icon={citation.icon}
          className="size-6 rounded-full bg-background ring-2 ring-background"
        />
      ))}
    </span>
  );
}

function CitationRow({
  citation,
  index,
  idPrefix,
}: {
  citation: CitationItem;
  index: number;
  idPrefix: string;
}) {
  const chat = useChatState();
  const opened = (url: string) => {
    const site = URL.parse(url)?.hostname.replace(/^www\./u, "");
    if (!chat?.saved || !site) return;
    void api.events.record
      .mutate({ name: "source.opened", props: { site, where: "panel" } })
      .catch(() => undefined);
  };
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CitationFavicon url={citation.url} icon={citation.icon} className="size-4" />
        <span className="min-w-0 truncate">{citation.domain}</span>
        <span className="ms-auto grid size-5 shrink-0 place-items-center rounded-md bg-foreground/[0.05] text-[10px] font-semibold tabular-nums">
          {index}
        </span>
      </span>
      <span className="line-clamp-2 text-sm text-foreground/85 transition-colors group-hover/citation:text-foreground">
        {citation.title}
      </span>
      {citation.snippet ? (
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {citation.snippet}
        </span>
      ) : null}
    </>
  );
  const className =
    "group/citation flex flex-col gap-0.5 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";
  const id = citationTargetId(idPrefix, citation.id);

  return citation.url ? (
    <a
      id={id}
      href={citation.url}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      onClick={() => citation.url && opened(citation.url)}
    >
      {content}
    </a>
  ) : (
    <div id={id} className={className}>
      {content}
    </div>
  );
}

const PAGE = 20;

export function CitationList({ citations, idPrefix, className }: CitationListProps) {
  const baseId = useId();
  const resolvedPrefix = idPrefix ?? `citation-list-${baseId.replace(/:/g, "")}`;
  const [shown, setShown] = useState(PAGE);
  const t = useT();

  return (
    <div className={cn("grid content-start gap-0.5", className)}>
      {citations.slice(0, shown).map((citation, index) => (
        <div key={citation.id}>
          {citation.group && citation.group !== citations[index - 1]?.group && (
            <p className="text-foreground px-2 pt-3 pb-1 text-xs font-medium">{citation.group}</p>
          )}
          <CitationRow citation={citation} index={index + 1} idPrefix={resolvedPrefix} />
        </div>
      ))}
      {shown < citations.length ? (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="bg-muted hover:bg-foreground/10 mx-2 mt-1 h-8 shrink-0 rounded-lg text-sm transition-colors"
        >
          {t("Show more")}
        </button>
      ) : null}
    </div>
  );
}
