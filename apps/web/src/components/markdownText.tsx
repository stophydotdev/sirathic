"use client";

import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import "katex/dist/katex.min.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  memoizeMarkdownComponents,
  type SyntaxHighlighterProps,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import type { Element } from "hast";
import { HoverCard } from "radix-ui";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import {
  type ComponentProps,
  type FC,
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useContext,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { z } from "zod";

import { TooltipIconButton } from "@/components/tooltipIconButton";
import {
  hidePendingCitation,
  rehypeBareCitations,
  rehypeCitations,
  rehypeVerses,
} from "@/components/citations";
import { Swap } from "@/components/swap";
import { Favicon } from "@/components/favicon";
import { siteName, SourcesContext } from "@/components/sources";
import { InlineVerse } from "@/components/verseCards";
import { useCopyToClipboard } from "@/lib/hooks/useCopyToClipboard";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const withMathDelimiters = (text: string) =>
  text
    .replaceAll(/\\\[([\s\S]*?)\\\]/gu, (_, math: string) => `\n$$\n${math}\n$$\n`)
    .replaceAll(/\\\(([\s\S]*?)\\\)/gu, (_, math: string) => `$$${math}$$`);

const closeOpenBold = (text: string) => {
  const trimmed = text.endsWith("*") && !text.endsWith("**") ? text.slice(0, -1) : text;
  if ((trimmed.match(/\*\*/gu)?.length ?? 0) % 2 === 0) return trimmed;
  return trimmed.endsWith("**") ? trimmed.slice(0, -2) : `${trimmed}**`;
};

const MarkdownTextImpl: FC<{ citations?: boolean }> = ({ citations = true }) => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
    rehypePlugins={[
      rehypeKatex,
      rehypeCitations,
      rehypeVerses,
      ...(citations ? [] : [rehypeBareCitations]),
    ]}
    preprocess={(text) => withMathDelimiters(closeOpenBold(hidePendingCitation(text)))}
    className="aui-md"
    components={citations ? components : withoutCitations}
  />
);

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHighlighter = lazy(() => import("@/components/codeHighlighter"));

const SyntaxHighlighter: FC<SyntaxHighlighterProps> = (props) => (
  <Suspense
    fallback={
      <pre className="text-[13px] leading-relaxed">
        <code>{props.code.trimEnd()}</code>
      </pre>
    }
  >
    <CodeHighlighter {...props} />
  </Suspense>
);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const t = useT();
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs">
      <span className="aui-code-header-language text-muted-foreground font-medium lowercase">
        {language}
      </span>
      <TooltipIconButton tooltip={t("Copy")} onClick={onCopy}>
        <Swap
          swapped={isCopied}
          from={<HugeiconsIcon icon={Copy01Icon} />}
          to={<HugeiconsIcon icon={Tick02Icon} />}
        />
      </TooltipIconButton>
    </div>
  );
};

const citedUrls = z.array(z.string()).min(1);

const Citation: FC<{ urls: string[] }> = ({ urls }) => {
  const sources = useContext(SourcesContext);
  const chat = useChatState();
  const [first, ...more] = urls;
  const name = siteName(first);
  const opened = (url: string) => {
    const site = URL.parse(url)?.hostname.replace(/^www\./u, "");
    if (!chat?.saved || !site) return;
    void api.events.record
      .mutate({ name: "source.opened", props: { site, where: "inline" } })
      .catch(() => undefined);
  };

  return (
    <HoverCard.Root openDelay={150} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <a
          href={first}
          target="_blank"
          rel="noreferrer"
          onClick={() => opened(first)}
          className="bg-muted text-muted-foreground! hover:text-foreground! relative -top-px ms-1 inline-flex max-w-[25ch] items-center gap-1 rounded-full py-[2.5px] ps-1 pe-2 align-middle text-[13px] leading-[15px] font-medium! no-underline! transition-colors"
        >
          <Favicon url={first} size={12} />
          <span className="truncate">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
          {more.length > 0 && <span>+{more.length}</span>}
        </a>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={6}
          className="bg-card border-border z-50 flex w-80 flex-col gap-1 rounded-xl border p-1 shadow-lg"
        >
          {urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={() => opened(url)}
              className="hover:bg-muted flex gap-2 rounded-lg p-2 text-sm"
            >
              <Favicon url={url} size={16} className="mt-0.5" />
              <span className="flex min-w-0 flex-col">
                <span className="text-muted-foreground line-clamp-1 text-xs">{siteName(url)}</span>
                <span className="line-clamp-2">{sources.get(url)?.title ?? url}</span>
              </span>
            </a>
          ))}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};

const Anchor: FC<ComponentProps<"a"> & { node?: Element }> = ({ node, className, ...props }) => {
  const urls = citedUrls.safeParse(node?.properties.dataUrls).data;
  if (urls) return <Citation urls={urls} />;
  return (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn("aui-md-a text-super hover:underline", className)}
      {...props}
    />
  );
};

const memoized = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      dir="auto"
      className={cn("aui-md-h1 mt-5 mb-2 text-lg font-[580] first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      dir="auto"
      className={cn("aui-md-h2 mt-5 mb-2 text-lg font-[580] first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      dir="auto"
      className={cn("aui-md-h3 mt-5 mb-2 text-lg font-[580] first:mt-0", className)}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      dir="auto"
      className={cn("aui-md-h4 mt-4 mb-1 text-base font-[580]", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p dir="auto" className={cn("aui-md-p mb-2 last:mb-0", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      dir="auto"
      className={cn(
        "aui-md-blockquote border-muted-foreground/30 text-muted-foreground my-3 border-s-2 ps-4",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul marker:text-muted-foreground mb-2 list-disc ps-8 [&>li]:ps-1.5",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol marker:text-muted-foreground mb-2 list-decimal ps-8 [&>li]:ps-1.5",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li dir="auto" className={cn("aui-md-li mb-1 [&>p]:mb-1", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("aui-md-hr border-border/50 my-4", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="aui-md-table-wrapper border-border/50 my-3 overflow-x-auto rounded-lg border">
      <table
        className={cn("aui-md-table w-full border-collapse text-sm leading-5", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      dir="auto"
      className={cn(
        "aui-md-th bg-muted px-3 py-2.5 text-start font-[580] [[align=center]]:text-center [[align=right]]:text-end",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      dir="auto"
      className={cn(
        "aui-md-td border-border/50 border-t px-3 py-2.5 text-start align-top [[align=center]]:text-center [[align=right]]:text-end",
        className,
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("aui-md-strong font-bold", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock && "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 text-[0.85em]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
  SyntaxHighlighter,
});

const verseUrl = z.string();

const Figure: FC<{ node?: Element; children?: ReactNode }> = ({ node, children }) => {
  const url = verseUrl.safeParse(node?.properties.dataVerse).data;
  return url ? <InlineVerse url={url} fallback={children} /> : null;
};

const components = { ...memoized, a: Anchor, figure: Figure };

const BareAnchor: FC<ComponentProps<"a"> & { node?: Element }> = (props) =>
  citedUrls.safeParse(props.node?.properties.dataUrls).success ? null : <Anchor {...props} />;

const withoutCitations = { ...components, a: BareAnchor };
