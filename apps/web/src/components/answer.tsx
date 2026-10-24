"use client";

import { useAccount } from "@/components/account";
import { StreamingResponse } from "@/components/agents/streamingResponse";
import { actionButton, AnswerExtras, useAnswer } from "@/components/answerActions";
import { Favicon } from "@/components/favicon";
import { MarkdownText } from "@/components/markdownText";
import { SourceRow } from "@/components/sourceRow";
import {
  CitationNumbers,
  citedUrlsOf,
  SourcesContext,
  siteName,
  sourcesOf,
  turnsOf,
} from "@/components/sources";
import { useSignIn } from "@/components/signIn";
import { useT } from "@/components/i18n";
import type { Source } from "@sirathic/server/sources";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  BranchPickerPrimitive,
  groupPartByType,
  MessagePrimitive,
  type MessageStatus,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { IconChevronLeft, IconChevronRight, IconCornerDownRight } from "@tabler/icons-react";
import { type FC, useState } from "react";
import { z } from "zod";
import { Research } from "@/components/researchSteps";

export const Reply: FC = () => {
  const content = useAuiState((s) => s.message.content);
  const sources = sourcesOf(content);
  const byUrl = new Map(sources.map((s) => [s.url, s]));
  const cited = citedUrlsOf(content).flatMap((url) => byUrl.get(url) ?? []);

  return (
    <SourcesContext value={byUrl}>
      <CitationNumbers value={new Map(cited.map((source, index) => [source.url, index + 1]))}>
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
  status === "running" ? "streaming" : status === "incomplete" ? "error" : "complete";

const citationOf = (source: Source) => ({
  id: source.url,
  title: source.title,
  domain: siteName(source.url),
  url: source.url,
  icon: <Favicon url={source.url} size={16} />,
});

const Answer: FC<{ sources: Source[]; cited: Source[] }> = ({ sources, cited }) => {
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
                  <Research
                    running={part.status.type === "running"}
                    indices={part.indices}
                    startedAt={startedAt}
                  />
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
    const part = s.message.parts.find((p) => p.type === "data" && p.name === "related");
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
    s.message.status?.type === "incomplete" && s.message.status.reason === "error"
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

export const ThreadLinks: FC = () => {
  const turns = turnsOf(useAuiState((s) => s.thread.messages));
  const t = useT();

  return (
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-8 pb-16">
      {turns.map((turn) => (
        <section key={turn.id} className="flex flex-col gap-2">
          <p className="text-muted-foreground px-2 text-sm">
            {t("Search results for:")} <span className="text-foreground">{turn.question}</span>
          </p>
          {turn.sources.length === 0 && (
            <p className="text-muted-foreground px-2 text-sm">{t("No links")}</p>
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
                  <span className="text-muted-foreground truncate text-xs">{source.url}</span>
                </span>
              </span>
              <span className="text-super mt-2 line-clamp-1 text-sm font-[470] group-hover/link:underline">
                {source.title}
              </span>
              {source.snippet && (
                <span dir="auto" className="text-muted-foreground line-clamp-2 text-sm">
                  {source.snippet}
                </span>
              )}
              {source.credit && (
                <span className="text-muted-foreground mt-1 text-xs">{source.credit}</span>
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
