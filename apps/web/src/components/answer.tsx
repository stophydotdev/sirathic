"use client";

import { useAccount } from "@/components/account";
import { StreamingResponse } from "@/components/agents/streamingResponse";
import { actionButton, AnswerExtras, useAnswer } from "@/components/answerActions";
import { AutomationCard } from "@/components/automationCard";
import { useChatState } from "@/components/chat";
import { useProjects } from "@/components/projects";
import { AskCard } from "@/components/questionCard";
import { Favicon } from "@/components/favicon";
import { MarkdownText } from "@/components/markdownText";
import { citedSourcesOf, SourcesContext, siteName, sourcesOf, turnsOf } from "@/components/sources";
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
import { IconChevronLeft, IconChevronRight, IconArrowDownRight } from "@tabler/icons-react";
import { type FC, useState } from "react";
import { z } from "zod";
import { ReportMistake } from "@/components/reportMistake";
import { Research } from "@/components/researchSteps";
import { Searched } from "@/components/threadMedia";

export const Reply: FC = () => {
  const content = useAuiState((s) => s.message.content);
  const sources = sourcesOf(content);

  return (
    <SourcesContext value={new Map(sources.map((s) => [s.url, s]))}>
      <Answer sources={sources} cited={citedSourcesOf(content)} />
    </SourcesContext>
  );
};

const research = groupPartByType({
  reasoning: ["group-research"],
  "tool-call:createAutomation": [],
  "tool-call:listAutomations": [],
  "tool-call:setBotJob": [],
  "tool-call:askUser": [],
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

const startTimes = new Map<string, number>();

const startOf = (messageId: string) => {
  const started = startTimes.get(messageId) ?? performance.now();
  startTimes.set(messageId, started);
  return started;
};

const Answer: FC<{ sources: Source[]; cited: Source[] }> = ({ sources, cited }) => {
  const aui = useAui();
  const state = useAuiState((s) => answerState(s.message.status?.type));
  const messageId = useAuiState((s) => s.message.id);
  const [streamed] = useState(state === "streaming");
  const [startedAt] = useState(() => startOf(messageId));
  const { feedback, rate, copy } = useAnswer();
  const [reporting, setReporting] = useState(false);

  return (
    <div className="pb-4">
      <StreamingResponse
        status={state}
        onCopy={copy}
        onRetry={() => aui.message().reload()}
        sources={cited.map(citationOf)}
        feedback={feedback}
        onFeedbackChange={(value) => (value === "down" ? setReporting(true) : rate(value))}
        actions={
          <AnswerExtras sources={sources}>
            <BranchPicker />
          </AnswerExtras>
        }
      >
        <MessagePrimitive.GroupedParts groupBy={research} indicator="empty">
          {({ part }) => {
            switch (part.type) {
              case "group-research":
                return <Research indices={part.indices} startedAt={startedAt} />;
              case "indicator":
                return <Research indices={[]} startedAt={startedAt} />;
              case "text":
                return <MarkdownText />;
              case "tool-call":
                return part.toolName === "askUser" ? (
                  <AskCard args={part.args} />
                ) : (
                  <AutomationCard tool={part.toolName} result={part.result} />
                );
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
      <ReportMistake
        open={reporting}
        onOpenChange={setReporting}
        onSend={(report) => rate("down", report)}
      />
    </div>
  );
};

const relatedData = z.object({ questions: z.array(z.string()).min(1) });

const Related: FC = () => {
  const raw = useAuiState((s) => {
    const part = s.message.parts.find((p) => p.type === "data" && p.name === "related");
    return part?.type === "data" ? part.data : undefined;
  });
  const projectId = useChatState()?.projectId;
  const inBot = useProjects((s) => s.bots?.some((bot) => bot.id === projectId) ?? false);
  const questions = relatedData.safeParse(raw).data?.questions;
  if (!questions || inBot) return null;

  return (
    <div className="border-border mt-4 border-t pt-3 print:hidden">
      {questions.map((question) => (
        <ThreadPrimitive.Suggestion
          key={question}
          prompt={question}
          send
          className="text-muted-foreground hover:bg-muted hover:text-foreground -mx-2 flex min-h-10 w-[calc(100%+1rem)] items-center gap-2 rounded-[12px] px-2 py-2 text-start text-sm font-medium transition-colors"
        >
          <IconArrowDownRight className="size-4 shrink-0" />
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

  const raw =
    z
      .string()
      .or(z.object({ message: z.string() }).transform((err) => err.message))
      .safeParse(error).data ?? t("The answer failed.");
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

const readableUrl = (url: string) => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

const FIRST_LINKS = 10;

type Turn = ReturnType<typeof turnsOf>[number];

const LinksTurn: FC<{ turn: Turn }> = ({ turn }) => {
  const [all, setAll] = useState(false);
  const t = useT();
  const shown = all ? turn.sources : turn.sources.slice(0, FIRST_LINKS);

  return (
    <section className="flex flex-col gap-2">
      <Searched queries={turn.queries} className="px-2" />
      {turn.sources.length === 0 && (
        <p className="text-muted-foreground px-2 text-sm">{t("No links")}</p>
      )}
      {shown.map((source) => (
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
                {readableUrl(source.url)}
              </span>
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
      {shown.length < turn.sources.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="bg-foreground/[0.06] hover:bg-foreground/10 h-8 self-center rounded-lg px-3.5 text-sm font-[470] transition-colors"
        >
          {t("View more")}
        </button>
      )}
    </section>
  );
};

export const ThreadLinks: FC = () => {
  const turns = turnsOf(useAuiState((s) => s.thread.messages));

  return (
    <div className="mx-auto flex w-full max-w-[736px] flex-col gap-8 px-6 pt-8 pb-16">
      {turns.map((turn) => (
        <LinksTurn key={turn.id} turn={turn} />
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
