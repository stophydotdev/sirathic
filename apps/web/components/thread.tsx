"use client";

import { useAccount } from "@/components/account";
import { StreamingResponse } from "@/components/agents/streaming-response";
import {
  actionButton,
  AnswerExtras,
  useAnswer,
} from "@/components/answer-actions";
import { useChatState } from "@/components/chat";
import { useChatOptions } from "@/components/chat-options";
import { AttachmentChip, Composer } from "@/components/composer";
import { ExportMenu } from "@/components/export-chat";
import { Favicon, FaviconStack } from "@/components/favicon";
import { Logo, Mark } from "@/components/logo";
import { MarkdownText } from "@/components/markdown-text";
import {
  type ResearchStep,
  readableQuery,
  stepsOf,
} from "@/components/research";
import { SourceRow } from "@/components/source-row";
import {
  CitationNumbers,
  citedUrlsOf,
  SourcesContext,
  siteName,
  sourcesOf,
  turnsOf,
} from "@/components/sources";
import { useSignIn } from "@/components/sign-in";
import { type Translate, useLocalePath, useT } from "@/components/i18n";
import { ThreadImages, ThreadVideos } from "@/components/thread-media";
import { ThreadShell } from "@/components/thread-shell";
import { ToolCards } from "@/components/tool-cards";
import { Skeleton } from "@/components/ui/skeleton";
import type { Source } from "@sirathic/server/sources";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  groupPartByType,
  MessagePrimitive,
  type MessageStatus,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  IconArrowDown,
  IconBook,
  IconCalculator,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCompass,
  IconCopy,
  IconCornerDownRight,
  IconHeartHandshake,
  IconMapPin,
  IconMessage,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconScale,
  IconScript,
  IconSearch,
  IconShare,
  IconSparkles,
  IconSpy,
  IconSun,
  IconTool,
  IconTrendingUp,
  IconWorld,
  type TablerIcon,
} from "@tabler/icons-react";
import { type FC, memo, type ReactNode, useEffect, useState } from "react";
import { z } from "zod";
import { create } from "zustand";

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

const TABS = [
  { id: "answer", name: "Answer", Icon: IconSparkles },
  { id: "links", name: "Links", Icon: IconWorld },
  { id: "images", name: "Images", Icon: IconPhoto },
  { id: "videos", name: "Videos", Icon: IconPlayerPlay },
] as const satisfies readonly {
  id: string;
  name: MessageKey;
  Icon: TablerIcon;
}[];

type Tab = (typeof TABS)[number]["id"];

const useThreadTab = create<{ tab: Tab; open: (tab: Tab) => void }>()(
  (set) => ({
    tab: "answer",
    open: (tab) => set({ tab }),
  }),
);

const ThreadImpl: FC = () => {
  const threadId = useAuiState((s) => s.threads.mainThreadId);
  useEffect(() => {
    useThreadTab.getState().open("answer");
  }, [threadId]);

  return (
    <ThreadShell>
      <ThreadPrimitive.Root className="bg-background text-foreground flex h-full flex-col print:h-auto">
        <AuiIf condition={(s) => s.thread.messages.length === 0}>
          <EmptyState />
        </AuiIf>

        <AuiIf condition={(s) => s.thread.messages.length > 0}>
          <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-auto print:overflow-visible">
            <TabBar />
            <ThreadBody />
          </ThreadPrimitive.Viewport>
        </AuiIf>
      </ThreadPrimitive.Root>
    </ThreadShell>
  );
};

export const Thread = memo(ThreadImpl);

const ANSWER_LINES = [
  ["w-full", "w-11/12", "w-5/6", "w-3/5"],
  ["w-4/5", "w-full", "w-2/3"],
];

const SOURCE_LINES = ["w-1/3", "w-full", "w-4/5", "w-2/5", "w-11/12", "w-3/4"];

export const ThreadSkeleton: FC = () => (
  <main className="h-dvh">
    <ThreadShell>
      <div className="bg-background flex h-full flex-col">
        <div className="border-border/50 h-14 shrink-0 border-b" />
        <div className="px-6">
          <TurnRow
            aside={
              <div className="bg-card border-foreground/8 flex flex-col gap-3.5 rounded-xl border p-4">
                {SOURCE_LINES.map((width) => (
                  <Skeleton key={width} className={cn("h-2.5", width)} />
                ))}
              </div>
            }
          >
            <div className="flex justify-end pt-8 pb-6">
              <Skeleton className="h-12 w-2/5 rounded-2xl" />
            </div>
            <div className="flex flex-col gap-7">
              {ANSWER_LINES.map((lines) => (
                <div key={lines[0]} className="flex flex-col gap-3.5">
                  {lines.map((width) => (
                    <Skeleton key={width} className={cn("h-2.5", width)} />
                  ))}
                </div>
              ))}
            </div>
          </TurnRow>
        </div>
        <div className="mt-auto px-6 pb-4">
          <TurnRow>
            <div className="bg-card border-foreground/10 h-[98px] rounded-2xl border" />
          </TurnRow>
        </div>
      </div>
    </ThreadShell>
  </main>
);

const TurnRow: FC<{ children: ReactNode; aside?: ReactNode }> = ({
  children,
  aside,
}) => {
  return (
    <div className="mx-auto grid w-full max-w-[720px] xl:max-w-none xl:grid-cols-[minmax(0,720px)_320px] xl:justify-between xl:ps-[35px]">
      <div className="min-w-0">{children}</div>
      {aside && (
        <aside className="hidden xl:block">
          <div className="sticky top-14 pt-4">{aside}</div>
        </aside>
      )}
    </div>
  );
};

const TabBar: FC = () => {
  const tab = useThreadTab((s) => s.tab);
  const open = useThreadTab((s) => s.open);
  const t = useT();
  const href = useLocalePath();

  return (
    <div className="bg-background border-border/50 sticky top-0 z-20 border-b pe-6 ps-14 lg:ps-6 print:hidden">
      <div className="absolute top-0 end-4 flex h-14 items-center">
        <HeaderActions />
      </div>
      <TurnRow>
        <div className="flex h-14 items-center gap-4">
          <a
            href={href("/")}
            aria-label={t("New chat")}
            className={cn(iconButton, "lg:hidden")}
          >
            <IconPlus className="size-4.5" />
          </a>
          <div role="tablist" className="flex h-full gap-5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => open(item.id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 text-sm font-[470] transition-colors",
                  tab === item.id
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                <item.Icon className="size-4" />
                <span className="max-sm:sr-only">{t(item.name)}</span>
              </button>
            ))}
          </div>
        </div>
      </TurnRow>
    </div>
  );
};

const timeOf = z.object({ createdAt: z.number() });

const HeaderActions: FC = () => {
  const chat = useChatState();
  const t = useT();
  const createdAt = useAuiState((s) => {
    const last = s.thread.messages.findLast(
      (message) => message.role === "assistant",
    );
    return timeOf.safeParse(last?.metadata.custom).data?.createdAt;
  });
  const [copied, setCopied] = useState(false);

  const share = () => {
    if (!chat?.saved) return;
    void navigator.clipboard
      .writeText(`${window.location.origin}/s/${chat.id}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      });
  };

  return (
    <div className="flex items-center gap-2">
      {createdAt !== undefined && (
        <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
          {new Date(createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      )}
      <IncognitoToggle />
      <ExportMenu
        onPrint={() => {
          useThreadTab.getState().open("answer");
          setTimeout(() => window.print(), 100);
        }}
      />
      <button
        type="button"
        onClick={share}
        disabled={!chat?.saved}
        title={t("Copy a link to this chat")}
        className="bg-foreground/10 hover:bg-foreground/15 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-[470] transition-colors disabled:opacity-40"
      >
        {copied ? (
          <IconCheck className="size-4" />
        ) : (
          <IconShare className="size-4" />
        )}
        <span className="hidden sm:inline">
          {copied ? t("Copied") : t("Share")}
        </span>
      </button>
    </div>
  );
};

const IncognitoToggle: FC = () => {
  const incognito = useChatOptions((s) => s.incognito);
  const setIncognito = useChatOptions((s) => s.setIncognito);
  const t = useT();

  return (
    <button
      type="button"
      aria-pressed={incognito}
      onClick={() => setIncognito(!incognito)}
      title={
        incognito
          ? t("Incognito is on: new messages aren't saved")
          : t("Use incognito: new messages aren't saved to your history")
      }
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 items-center gap-1.5 rounded-full px-2 text-sm transition-colors",
        incognito && "bg-super/15 text-super hover:text-super",
      )}
    >
      <IconSpy className="size-4" />
      {incognito && t("Incognito")}
    </button>
  );
};

const ThreadBody: FC = () => {
  const tab = useThreadTab((s) => s.tab);
  const t = useT();
  if (tab === "links") return <ThreadLinks />;
  if (tab === "images") return <ThreadImages />;
  if (tab === "videos") return <ThreadVideos />;

  return (
    <>
      <div className="px-6">
        <TurnRow aside={<SourcesPane />}>
          <ThreadPrimitive.Messages>{() => <Turn />}</ThreadPrimitive.Messages>
        </TurnRow>
      </div>
      <ThreadPrimitive.ViewportFooter className="bg-background sticky bottom-0 mt-auto px-6 pb-4 print:hidden">
        <TurnRow>
          <div className="relative">
            <ThreadPrimitive.ScrollToBottom className="bg-card border-border text-muted-foreground hover:text-foreground absolute -top-11 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border disabled:invisible">
              <IconArrowDown className="size-4" />
            </ThreadPrimitive.ScrollToBottom>
            <Composer placeholder={t("Ask a follow-up")} menuSide="top" />
          </div>
        </TurnRow>
      </ThreadPrimitive.ViewportFooter>
    </>
  );
};

const EmptyState: FC = () => {
  const t = useT();
  return (
    <div className="relative flex h-full flex-col px-4 pb-5 md:justify-center md:px-6 md:pb-[16vh]">
      <span className="absolute top-3 start-11 flex h-8 items-center lg:hidden">
        <Logo height={22} />
      </span>
      <div className="absolute top-3 end-4">
        <IncognitoToggle />
      </div>
      <div className="mx-auto flex w-full max-w-[640px] flex-col max-md:flex-1">
        <div className="mb-9 flex flex-col items-center gap-5 max-md:my-auto">
          <Mark size={26} color="currentColor" />
          <h1 className="px-4 text-center text-2xl tracking-[-0.02em] md:text-[26px]">
            {t("What do you want to know?")}
          </h1>
        </div>
        <Composer placeholder={t("Ask anything…")} menuSide="bottom" rotate />
      </div>
    </div>
  );
};

const Turn: FC = () => {
  const role = useAuiState((s) => s.message.role);

  return (
    <MessagePrimitive.Root className="group/message">
      {role === "user" ? <Question /> : role === "assistant" ? <Reply /> : null}
    </MessagePrimitive.Root>
  );
};

const Question: FC = () => {
  const t = useT();
  return (
    <>
      <AuiIf condition={(s) => !s.message.composer.isEditing}>
        <div className="flex w-full items-start justify-end gap-1 pt-8 pb-6">
          <ActionBarPrimitive.Root className="mt-2.5 flex opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:mt-1.5 pointer-coarse:opacity-100 print:hidden">
            <ActionBarPrimitive.Edit
              className={cn(iconButton, "size-6 pointer-coarse:size-9")}
              aria-label={t("Edit query")}
            >
              <IconPencil className="size-3" />
            </ActionBarPrimitive.Edit>
            <ActionBarPrimitive.Copy
              className={cn(iconButton, "size-6 pointer-coarse:size-9")}
              aria-label={t("Copy query")}
            >
              <IconCopy className="size-3" />
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
          <div className="flex max-w-[85%] flex-col items-end gap-2">
            <AuiIf condition={(s) => !!s.message.attachments?.length}>
              <div className="flex flex-wrap justify-end gap-2">
                <MessagePrimitive.Attachments>
                  {() => (
                    <AttachmentPrimitive.Root>
                      <AttachmentChip />
                    </AttachmentPrimitive.Root>
                  )}
                </MessagePrimitive.Attachments>
              </div>
            </AuiIf>
            <div className="bg-foreground/3 rounded-2xl px-4 py-3 wrap-break-word whitespace-pre-line">
              <MessagePrimitive.Parts />
            </div>
          </div>
        </div>
      </AuiIf>
      <AuiIf condition={(s) => s.message.composer.isEditing}>
        <ComposerPrimitive.Root className="bg-card my-6 flex flex-col gap-2 rounded-2xl p-3">
          <ComposerPrimitive.Input className="w-full resize-none bg-transparent px-2 pt-1 text-base outline-none" />
          <div className="flex justify-end gap-2">
            <ComposerPrimitive.Cancel className="hover:bg-muted h-8 rounded-lg px-3 text-sm">
              {t("Cancel")}
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send className="bg-primary text-primary-foreground h-8 rounded-lg px-3 text-sm">
              {t("Save")}
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </AuiIf>
    </>
  );
};

const SourcesPane: FC = () => {
  const messages = useAuiState((s) => s.thread.messages);
  const t = useT();
  const [chosen, setChosen] = useState<boolean>();
  const open = chosen ?? true;
  const turns = turnsOf(messages).filter((turn) => turn.sources.length > 0);
  const urls = [
    ...new Set(turns.flatMap((turn) => turn.sources.map((s) => s.url))),
  ];
  if (urls.length === 0) return null;

  return (
    <div className="bg-card border-foreground/8 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setChosen(!open)}
        className="flex w-full items-center gap-2 py-3 pe-2 ps-3"
      >
        <span className="text-muted-foreground flex-1 text-start text-sm">
          {t("Sources")}
        </span>
        {!open && <FaviconStack urls={urls} />}
        <span className="text-muted-foreground flex items-center gap-1 text-sm tabular-nums">
          {!open && urls.length}
          <IconChevronRight
            className={cn(
              "size-4 transition-transform rtl:rotate-180",
              open && "rotate-90 rtl:rotate-90",
            )}
          />
        </span>
      </button>
      {open && (
        <div className="flex max-h-[min(28rem,calc(100dvh-12rem))] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {turns.map((turn) => (
            <section key={turn.id} className="flex flex-col gap-1">
              {turns.length > 1 && (
                <p className="text-muted-foreground truncate px-2 pt-2 text-xs">
                  Results for “{turn.question}”
                </p>
              )}
              {turn.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:bg-muted flex gap-2 rounded-xl p-2 text-sm"
                >
                  <Favicon url={source.url} size={16} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      {siteName(source.url)}
                    </span>
                    <span className="line-clamp-2">{source.title}</span>
                    {source.snippet && (
                      <span
                        dir="auto"
                        className="text-muted-foreground line-clamp-4"
                      >
                        {source.snippet}
                      </span>
                    )}
                    {source.credit && (
                      <span className="text-muted-foreground text-xs">
                        {source.credit}
                      </span>
                    )}
                  </span>
                </a>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const Reply: FC = () => {
  const content = useAuiState((s) => s.message.content);
  const sources = sourcesOf(content);
  const byUrl = new Map(sources.map((s) => [s.url, s]));
  const cited = citedUrlsOf(content).flatMap((url) => byUrl.get(url) ?? []);

  return (
    <SourcesContext value={byUrl}>
      <CitationNumbers
        value={new Map(cited.map((source, index) => [source.url, index + 1]))}
      >
        <Answer sources={sources} cited={cited} />
      </CitationNumbers>
    </SourcesContext>
  );
};

const research = groupPartByType({
  reasoning: ["group-research"],
  "tool-call": ["group-research"],
});

const answerState = (status: MessageStatus["type"] | undefined) =>
  status === "running"
    ? "streaming"
    : status === "incomplete"
      ? "error"
      : "complete";

const citationOf = (source: Source) => ({
  id: source.url,
  title: source.title,
  domain: siteName(source.url),
  url: source.url,
  icon: <Favicon url={source.url} size={16} />,
});

const Answer: FC<{ sources: Source[]; cited: Source[] }> = ({
  sources,
  cited,
}) => {
  const aui = useAui();
  const state = useAuiState((s) => answerState(s.message.status?.type));
  const [streamed] = useState(state === "streaming");
  const [startedAt] = useState(() => performance.now());
  const { feedback, rate, copy } = useAnswer();

  return (
    <div className="pb-4">
      <StreamingResponse
        status={state}
        onCopy={copy}
        onRetry={() => aui.message().reload()}
        sources={sources.map(citationOf)}
        feedback={feedback}
        onFeedbackChange={rate}
        actions={
          <AnswerExtras sources={sources}>
            <BranchPicker />
          </AnswerExtras>
        }
      >
        <SourceRow sources={cited} />
        <MessagePrimitive.GroupedParts groupBy={research} indicator="empty">
          {({ part }) => {
            switch (part.type) {
              case "group-research":
                return (
                  <>
                    <Research
                      running={part.status.type === "running"}
                      indices={part.indices}
                      startedAt={startedAt}
                    />
                    <ToolCards indices={part.indices} />
                  </>
                );
              case "indicator":
                return <Research running indices={[]} startedAt={startedAt} />;
              case "text":
                return <MarkdownText />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <ReplyError />
      </StreamingResponse>

      <AuiIf condition={(s) => s.message.status?.type !== "running"}>
        <div
          className={cn(
            streamed &&
              "animate-in fade-in motion-safe:slide-in-from-bottom-1 duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          )}
        >
          <Related />
        </div>
      </AuiIf>
    </div>
  );
};

const relatedData = z.object({ questions: z.array(z.string()).min(1) });

const Related: FC = () => {
  const raw = useAuiState((s) => {
    const part = s.message.parts.find(
      (p) => p.type === "data" && p.name === "related",
    );
    return part?.type === "data" ? part.data : undefined;
  });
  const questions = relatedData.safeParse(raw).data?.questions;
  if (!questions) return null;

  return (
    <div className="border-border/50 mt-4 border-t pt-2 print:hidden">
      {questions.map((question) => (
        <ThreadPrimitive.Suggestion
          key={question}
          prompt={question}
          send
          className="hover:bg-muted -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-3 text-start text-base"
        >
          <IconCornerDownRight className="text-muted-foreground size-4 shrink-0" />
          {question}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
};

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return (now - startedAt) / 1000;
}

const Research: FC<{
  running: boolean;
  indices: readonly number[];
  startedAt: number;
}> = ({ running, indices, startedAt }) => {
  const parts = useAuiState((s) => s.message.parts);
  const timing = useAuiState((s) => s.message.metadata.timing);
  const composing = useAuiState(
    (s) =>
      s.message.status?.type === "running" &&
      !s.message.parts.some((part) => part.type === "text" && part.text),
  );
  const working = running || composing;
  const [live] = useState(working);
  const t = useT();
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(startedAt, working);
  const steps = stepsOf(
    indices.map((i) => parts[i]).filter((part) => part !== undefined),
  );
  const researched = live
    ? Math.max(1, Math.round(elapsed))
    : timing?.firstTokenTime === undefined
      ? undefined
      : Math.max(
          1,
          Math.round((timing.firstTokenTime - timing.streamStartTime) / 1000),
        );
  const seconds = working
    ? Math.floor(elapsed) > 0
      ? Math.floor(elapsed)
      : undefined
    : researched;
  const latest = steps.at(-1);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={steps.length === 0}
        className="text-muted-foreground enabled:hover:text-foreground flex items-center gap-1 text-sm"
      >
        {working ? t("Researching") : t("Researched")}
        {seconds !== undefined && (
          <span className="text-muted-foreground/70 tabular-nums">
            {seconds}s
          </span>
        )}
        {steps.length > 0 && (
          <IconChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !open && "-rotate-90",
            )}
          />
        )}
      </button>
      {open ? (
        <div className="relative pt-3 ps-[19px]">
          <span className="bg-border absolute top-3 bottom-1 start-[6px] w-px" />
          <div className="grid gap-4">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} />
            ))}
          </div>
        </div>
      ) : (
        working &&
        latest && (
          <div className="pt-3">
            <StepRow step={latest} />
          </div>
        )
      )}
    </div>
  );
};

const quran = <IconBook className="size-4" />;
const hadith = <IconScript className="size-4" />;
const fiqh = <IconScale className="size-4" />;
const calculator = <IconCalculator className="size-4" />;
const calendar = <IconCalendar className="size-4" />;
const place = <IconMapPin className="size-4" />;

const TOOL_STEPS = new Map<
  string,
  { icon: ReactNode; label: (t: Translate, detail: string) => string }
>([
  [
    "quranSearch",
    {
      icon: quran,
      label: (t, d) => t("Searching the Quran for {detail}", { detail: d }),
    },
  ],
  ["quranGet", { icon: quran, label: (t) => t("Reading the Quran") }],
  [
    "hadithSearch",
    {
      icon: hadith,
      label: (t, d) => t("Searching hadith for {detail}", { detail: d }),
    },
  ],
  ["hadithGet", { icon: hadith, label: (t) => t("Reading hadith") }],
  [
    "hadithCheck",
    {
      icon: hadith,
      label: (t, d) => t("Checking the hadith {detail}", { detail: d }),
    },
  ],
  [
    "fiqhSearch",
    {
      icon: fiqh,
      label: (t, d) => t("Searching fiqh books for {detail}", { detail: d }),
    },
  ],
  ["fiqhGet", { icon: fiqh, label: (t) => t("Reading fiqh books") }],
  [
    "duaSearch",
    {
      icon: <IconHeartHandshake className="size-4" />,
      label: (t, d) => t("Finding duas for {detail}", { detail: d }),
    },
  ],
  [
    "namedReference",
    { icon: quran, label: (t, d) => t("Looking up {detail}", { detail: d }) },
  ],
  [
    "namesOfAllah",
    { icon: quran, label: (t) => t("Looking up the names of Allah") },
  ],
  [
    "prayerTimes",
    {
      icon: <IconSun className="size-4" />,
      label: (t) => t("Calculating prayer times"),
    },
  ],
  [
    "qibla",
    {
      icon: <IconCompass className="size-4" />,
      label: (t) => t("Finding the qibla"),
    },
  ],
  ["hijriDate", { icon: calendar, label: (t) => t("Converting the date") }],
  [
    "islamicCalendar",
    { icon: calendar, label: (t) => t("Checking the Islamic calendar") },
  ],
  [
    "geocode",
    { icon: place, label: (t, d) => t("Finding {detail}", { detail: d }) },
  ],
  [
    "redditThread",
    {
      icon: <IconMessage className="size-4" />,
      label: (t) => t("Reading a Reddit thread"),
    },
  ],
  [
    "zakatCalculator",
    { icon: calculator, label: (t) => t("Calculating zakat") },
  ],
  [
    "zakatAlFitr",
    { icon: calculator, label: (t) => t("Calculating zakat al-fitr") },
  ],
  [
    "fidyaKaffarah",
    { icon: calculator, label: (t) => t("Calculating fidya and kaffarah") },
  ],
  [
    "inheritance",
    { icon: calculator, label: (t) => t("Calculating inheritance shares") },
  ],
  ["islamicUnits", { icon: calculator, label: (t) => t("Converting units") }],
  [
    "calculator",
    {
      icon: calculator,
      label: (t, d) => t("Calculating {detail}", { detail: d }),
    },
  ],
  [
    "halalStockScreen",
    {
      icon: <IconTrendingUp className="size-4" />,
      label: (t, d) => t("Screening {detail}", { detail: d }),
    },
  ],
]);

const chip =
  "bg-muted text-muted-foreground flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs";

const line = (icon: ReactNode, label: string, chips?: ReactNode) => (
  <div className="flex min-w-0 flex-col gap-2">
    <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
      <span className="bg-background flex size-5 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
    {chips && <div className="flex flex-wrap gap-1.5 ps-7">{chips}</div>}
  </div>
);

const StepRow: FC<{ step: ResearchStep }> = ({ step }) => {
  const t = useT();
  switch (step.kind) {
    case "think":
      return line(<IconSparkles className="size-4" />, step.text);
    case "search":
      return line(
        <IconSearch className="size-4" />,
        t("Searching"),
        step.queries.map((query) => (
          <span key={query} className={chip}>
            <IconSearch className="size-3 shrink-0" />
            <span className="truncate">{readableQuery(query)}</span>
          </span>
        )),
      );
    case "read":
      return line(
        <IconBook className="size-4" />,
        t("Reading"),
        step.urls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={cn(chip, "hover:text-foreground")}
          >
            <Favicon url={url} size={12} />
            <span className="truncate">{siteName(url)}</span>
          </a>
        )),
      );
    case "tool": {
      const tool = TOOL_STEPS.get(step.tool);
      return line(
        tool?.icon ?? <IconTool className="size-4" />,
        tool ? tool.label(t, step.detail) : step.tool,
      );
    }
    default: {
      const unknownStep: never = step;
      return unknownStep;
    }
  }
};

const errorBody = z.object({ error: z.string() });
const jsonText = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text);
  } catch {
    ctx.addIssue({ code: "custom", message: "not json" });
    return z.NEVER;
  }
});

const ReplyError: FC = () => {
  const error = useAuiState((s) =>
    s.message.status?.type === "incomplete" &&
    s.message.status.reason === "error"
      ? s.message.status.error
      : undefined,
  );
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const ask = useSignIn((s) => s.ask);
  const t = useT();
  if (error === undefined) return null;

  const raw = z.string().safeParse(error).data ?? t("The answer failed.");
  const message = jsonText.pipe(errorBody).safeParse(raw).data?.error ?? raw;

  return (
    <div className="bg-card mt-2 flex items-center gap-3 rounded-xl p-3 text-sm">
      <span className="text-muted-foreground flex-1">{message}</span>
      {signedOut && (
        <button
          type="button"
          onClick={() => ask()}
          className="bg-primary text-primary-foreground h-9 rounded-full px-4 text-sm font-[470] transition hover:opacity-85"
        >
          {t("Sign in")}
        </button>
      )}
    </div>
  );
};

const ThreadLinks: FC = () => {
  const turns = turnsOf(useAuiState((s) => s.thread.messages));
  const t = useT();

  return (
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-8 pb-16">
      {turns.map((turn) => (
        <section key={turn.id} className="flex flex-col gap-2">
          <p className="text-muted-foreground px-2 text-sm">
            {t("Search results for:")}{" "}
            <span className="text-foreground">{turn.question}</span>
          </p>
          {turn.sources.length === 0 && (
            <p className="text-muted-foreground px-2 text-sm">
              {t("No links")}
            </p>
          )}
          {turn.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="group/link hover:bg-muted flex flex-col rounded-xl p-2"
            >
              <span className="flex items-center gap-3">
                <Favicon url={source.url} size={28} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{siteName(source.url)}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {source.url}
                  </span>
                </span>
              </span>
              <span className="text-super mt-2 line-clamp-1 text-sm font-[470] group-hover/link:underline">
                {source.title}
              </span>
              {source.snippet && (
                <span
                  dir="auto"
                  className="text-muted-foreground line-clamp-2 text-sm"
                >
                  {source.snippet}
                </span>
              )}
              {source.credit && (
                <span className="text-muted-foreground mt-1 text-xs">
                  {source.credit}
                </span>
              )}
            </a>
          ))}
        </section>
      ))}
    </div>
  );
};

const BranchPicker: FC = () => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="text-muted-foreground inline-flex items-center gap-1 text-xs"
    >
      <BranchPickerPrimitive.Previous className={actionButton}>
        <IconChevronLeft className="size-3.5 rtl:rotate-180" />
      </BranchPickerPrimitive.Previous>
      <span className="min-w-9 text-center tabular-nums">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next className={actionButton}>
        <IconChevronRight className="size-3.5 rtl:rotate-180" />
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
