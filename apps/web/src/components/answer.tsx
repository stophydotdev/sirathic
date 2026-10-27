"use client";

import { useAccount } from "@/components/account";
import { StreamingResponse } from "@/components/agents/streamingResponse";
import { actionButton, AnswerExtras, useAnswer } from "@/components/answerActions";
import { AutomationCard } from "@/components/automationCard";
import { ConfirmCard } from "@/components/confirmCard";
import { AskCard } from "@/components/questionCard";
import { Favicon } from "@/components/favicon";
import { MarkdownText } from "@/components/markdownText";
import { groupsOf, KIND_NAMES, SourcesContext, siteName, sourcesOf } from "@/components/sources";
import { useSignIn } from "@/components/signIn";
import { useT } from "@/components/i18n";
import { currentToolName } from "@sirathic/server/messages";
import type { Source } from "@sirathic/server/sources";
import {
  BranchPickerPrimitive,
  groupPartByType,
  MessagePrimitive,
  type MessageStatus,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";
import { z } from "zod";
import { ReportMistake } from "@/components/reportMistake";
import { Research } from "@/components/researchSteps";

export const Reply: FC = () => {
  const content = useAuiState((s) => s.message.content);
  const sources = sourcesOf(content);

  return (
    <SourcesContext value={new Map(sources.map((s) => [s.url, s]))}>
      <Answer sources={sources} />
    </SourcesContext>
  );
};

const researchByType = groupPartByType({
  reasoning: ["group-research"],
  "tool-call:createAutomation": [],
  "tool-call:listAutomations": [],
  "tool-call:setBotJob": [],
  "tool-call:set_bot_job": [],
  "tool-call:askUser": [],
  "tool-call:clarifying_questions": [],
  "tool-call": ["group-research"],
});

const research: typeof researchByType = (part, context) =>
  part.type === "tool-call" && part.approval ? [] : researchByType(part, context);

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

const Answer: FC<{ sources: Source[] }> = ({ sources }) => {
  const aui = useAui();
  const state = useAuiState((s) => answerState(s.message.status?.type));
  const messageId = useAuiState((s) => s.message.id);
  const [startedAt] = useState(() => startOf(messageId));
  const { feedback, rate, copy } = useAnswer();
  const [reporting, setReporting] = useState(false);
  const t = useT();

  return (
    <div className="pb-4">
      <StreamingResponse
        status={state}
        onCopy={copy}
        onRetry={() => aui.message().reload()}
        sources={groupsOf(sources).flatMap((group) =>
          group.sources.map((source) => ({
            ...citationOf(source),
            group: t(KIND_NAMES[group.kind]),
          })),
        )}
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
                return currentToolName(part.toolName) === "clarifying_questions" ? (
                  <AskCard args={part.args} />
                ) : (
                  <>
                    {part.approval && <ConfirmCard call={part} />}
                    <AutomationCard tool={part.toolName} result={part.result} />
                  </>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <ReplyError />
      </StreamingResponse>

      <ReportMistake
        open={reporting}
        onOpenChange={setReporting}
        onSend={(report) => rate("down", report)}
      />
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

export const ReplyError: FC = () => {
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

const BranchPicker: FC = () => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="text-muted-foreground inline-flex items-center gap-1 text-xs"
    >
      <BranchPickerPrimitive.Previous className={actionButton}>
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5 rtl:rotate-180" />
      </BranchPickerPrimitive.Previous>
      <span className="min-w-9 text-center tabular-nums">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next className={actionButton}>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 rtl:rotate-180" />
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
