"use client";

import { useT } from "@/components/i18n";
import type { PlainKey } from "@/components/locales";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  RotateClockwiseIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { type CitationItem, CitationList, CitationStack } from "@/components/agents/citations";
import { useOpenSources } from "@/components/openSources";
import { SPRING_PRESS } from "@/lib/ease";
import { Swap } from "@/components/swap";
import { cn } from "@/lib/utils";

type StreamingResponseStatus = "streaming" | "complete" | "error";
export type StreamingResponseFeedback = "up" | "down" | null;

export interface StreamingResponseProps {
  children: ReactNode;
  status?: StreamingResponseStatus;
  copyText?: string;
  onCopy?: () => void | Promise<void>;
  onRetry?: () => void;
  sources?: CitationItem[];
  sourceIdPrefix?: string;
  feedback?: StreamingResponseFeedback;
  defaultFeedback?: StreamingResponseFeedback;
  onFeedbackChange?: (feedback: StreamingResponseFeedback) => void;
  announce?: boolean;
  showActions?: boolean;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
}

function ResponseAction({
  label,
  active = false,
  onClick,
  children,
}: {
  label: PlainKey;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() ?? false;
  const t = useT();

  return (
    <motion.button
      type="button"
      aria-label={t(label)}
      title={t(label)}
      aria-pressed={label === "Helpful" || label === "Not helpful" ? active : undefined}
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      transition={SPRING_PRESS}
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

export function StreamingResponse({
  children,
  status = "streaming",
  copyText,
  onCopy,
  onRetry,
  sources = [],
  sourceIdPrefix,
  feedback,
  defaultFeedback = null,
  onFeedbackChange,
  announce = true,
  showActions = true,
  actions,
  className,
  contentClassName,
  actionsClassName,
}: StreamingResponseProps) {
  const t = useT();
  const baseId = useId();
  const [copied, setCopied] = useState(false);
  const [internalFeedback, setInternalFeedback] =
    useState<StreamingResponseFeedback>(defaultFeedback);
  const copyTimer = useRef<number | undefined>(undefined);
  const currentFeedback = feedback ?? internalFeedback;
  const currentSourcesOpen = useOpenSources((s) => s.id === baseId);
  const streaming = status === "streaming";
  const complete = status === "complete";
  const canCopy = Boolean(copyText || onCopy);
  const hasSources = sources.length > 0;
  const shouldShowActions =
    showActions && !streaming && (canCopy || onRetry || complete || hasSources);
  const sourcesContentId = `${baseId}-sources`;
  const resolvedSourcePrefix = sourceIdPrefix ?? `response-source-${baseId.replace(/:/g, "")}`;

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      if (useOpenSources.getState().id === baseId) useOpenSources.setState({ id: undefined });
    },
    [baseId],
  );

  const handleCopy = useCallback(async () => {
    if (onCopy) await onCopy();
    else if (copyText) await navigator.clipboard?.writeText(copyText);

    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [copyText, onCopy]);

  const setFeedback = (next: Exclude<StreamingResponseFeedback, null>) => {
    const value = currentFeedback === next ? null : next;
    if (feedback === undefined) setInternalFeedback(value);
    onFeedbackChange?.(value);
  };

  const setSourcesOpen = (next: boolean) =>
    useOpenSources.setState({ id: next ? baseId : undefined });

  return (
    <div data-state={status} aria-busy={streaming} className={cn("w-full", className)}>
      <div
        aria-live={announce ? "polite" : "off"}
        className={cn(
          "text-base leading-[26px] text-foreground/90 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5 [&_p+p]:mt-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/45 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5",
          contentClassName,
        )}
      >
        {children}
      </div>

      {shouldShowActions ? (
        <div className="mt-3 print:hidden">
          <div className={cn("flex items-center gap-0.5", actionsClassName)}>
            {canCopy ? (
              <ResponseAction label={copied ? "Copied" : "Copy response"} onClick={handleCopy}>
                <Swap
                  swapped={copied}
                  from={<HugeiconsIcon icon={Copy01Icon} className="size-3.5" />}
                  to={<HugeiconsIcon icon={Tick02Icon} className="size-3.5" />}
                />
              </ResponseAction>
            ) : null}
            {complete ? (
              <>
                <ResponseAction
                  label="Helpful"
                  active={currentFeedback === "up"}
                  onClick={() => setFeedback("up")}
                >
                  <HugeiconsIcon icon={ThumbsUpIcon} className="size-3.5" />
                </ResponseAction>
                <ResponseAction
                  label="Not helpful"
                  active={currentFeedback === "down"}
                  onClick={() => setFeedback("down")}
                >
                  <HugeiconsIcon icon={ThumbsDownIcon} className="size-3.5" />
                </ResponseAction>
              </>
            ) : null}
            {onRetry ? (
              <ResponseAction label="Retry response" onClick={onRetry}>
                <HugeiconsIcon icon={RotateClockwiseIcon} className="size-3.5" />
              </ResponseAction>
            ) : null}
            {actions}
            {hasSources ? (
              <button
                type="button"
                aria-expanded={currentSourcesOpen}
                aria-controls={sourcesContentId}
                onClick={() => setSourcesOpen(!currentSourcesOpen)}
                className="bg-muted text-foreground hover:bg-foreground/10 focus-visible:ring-ring ms-1 inline-flex h-[31px] items-center gap-1.5 rounded-full ps-1 pe-2.5 text-sm outline-none transition-colors focus-visible:ring-2"
              >
                <CitationStack citations={sources} />
                <span className="tabular-nums">
                  {sources.length === 1
                    ? t("1 source")
                    : t("{count} sources", { count: sources.length })}
                </span>
              </button>
            ) : null}
          </div>

          {hasSources ? (
            <Dialog.Root open={currentSourcesOpen} onOpenChange={setSourcesOpen} modal={false}>
              <Dialog.Portal>
                <Dialog.Content
                  id={sourcesContentId}
                  aria-describedby={undefined}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  onInteractOutside={(event) => event.preventDefault()}
                  className="pop bg-card ring-foreground/7 fixed end-2 top-16 z-30 flex max-h-3/4 w-80 origin-top-right flex-col rounded-2xl shadow-lg ring-1 outline-none ring-inset md:end-4 rtl:origin-top-left"
                >
                  <div className="flex h-12 shrink-0 items-center justify-between ps-4 pe-2">
                    <Dialog.Title className="text-sm font-medium">
                      {t("Sources")}{" "}
                      <span className="text-muted-foreground tabular-nums">{sources.length}</span>
                    </Dialog.Title>
                    <Dialog.Close
                      aria-label={t("Close")}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-8 place-items-center rounded-full transition-colors"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                    </Dialog.Close>
                  </div>
                  <CitationList
                    citations={sources}
                    idPrefix={resolvedSourcePrefix}
                    className="min-h-0 overflow-y-auto px-2 pb-2"
                  />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
