"use client";

import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { Copy01Icon, TextWrapIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type FC, lazy, type ReactNode, Suspense, useState } from "react";

import { useT } from "@/components/i18n";
import { Swap } from "@/components/swap";
import { TooltipIconButton } from "@/components/tooltipIconButton";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

const CodeHighlighter = lazy(() => import("@/components/codeHighlighter"));

const fenceTitle = /title="([^"]+)"/u;

export const CodeBlock: FC<SyntaxHighlighterProps & { actions?: ReactNode }> = ({
  node,
  language,
  code,
  actions,
}) => {
  const t = useT();
  const [wrapped, setWrapped] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const title = fenceTitle.exec(node?.data?.meta ?? "")?.[1];
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <>
      <div className="aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between gap-3 rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <span className="aui-code-header-language text-muted-foreground font-medium lowercase">
            {language}
          </span>
          {title && <span className="text-foreground truncate font-medium">{title}</span>}
        </span>
        <span className="flex items-center gap-0.5">
          {actions}
          <TooltipIconButton
            tooltip={t("Wrap lines")}
            aria-pressed={wrapped}
            onClick={() => setWrapped(!wrapped)}
            className={cn(wrapped && "bg-muted text-foreground")}
          >
            <HugeiconsIcon icon={TextWrapIcon} />
          </TooltipIconButton>
          <TooltipIconButton tooltip={t("Copy")} onClick={onCopy}>
            <Swap
              swapped={isCopied}
              from={<HugeiconsIcon icon={Copy01Icon} />}
              to={<HugeiconsIcon icon={Tick02Icon} />}
            />
          </TooltipIconButton>
        </span>
      </div>
      <Suspense
        fallback={
          <pre
            className={cn(
              "text-[13px] leading-relaxed",
              wrapped && "wrap-break-word whitespace-pre-wrap",
            )}
          >
            <code>{code.trimEnd()}</code>
          </pre>
        }
      >
        <CodeHighlighter language={language} code={code} wrapped={wrapped} />
      </Suspense>
    </>
  );
};
