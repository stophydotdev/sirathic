"use client";

import { useAnswer } from "@/components/answerActions";
import { ReplyError } from "@/components/answer";
import { AutomationCard, isCardTool } from "@/components/automationCard";
import { AttachmentChip } from "@/components/composer";
import { useT } from "@/components/i18n";
import { MarkdownText } from "@/components/markdownText";
import { UserText } from "@/components/mentions";
import { ConfirmCard } from "@/components/confirmCard";
import { AskCard } from "@/components/questionCard";
import { ReportMistake } from "@/components/reportMistake";
import { SourcesContext, sourcesOf } from "@/components/sources";
import { cn } from "@/lib/utils";
import { currentToolName, messageMetadata } from "@sirathic/server/messages";
import {
  AttachmentPrimitive,
  AuiIf,
  MessagePrimitive,
  TextMessagePartProvider,
  type ThreadMessage,
  useAuiState,
} from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, ThumbsDownIcon, ThumbsUpIcon } from "@hugeicons/core-free-icons";
import { type FC, useEffect, useRef, useState } from "react";

const actionButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-full pointer-coarse:size-9";

const bubblesOf = (text: string) => {
  const bubbles: string[] = [];
  for (const block of text.split(/\n\s*\n/u)) {
    const last = bubbles.at(-1);
    if (last && (last.match(/```/gu)?.length ?? 0) % 2 === 1) {
      bubbles[bubbles.length - 1] = `${last}\n\n${block}`;
    } else if (block.trim()) bubbles.push(block);
  }
  return bubbles;
};

type Part = ThreadMessage["content"][number];

type Said =
  | { kind: "text"; text: string }
  | { kind: "tool"; part: Extract<Part, { type: "tool-call" }> };

const saidOf = (content: ThreadMessage["content"]) =>
  content.flatMap<Said>((part) => {
    if (part.type === "text") return bubblesOf(part.text).map((text) => ({ kind: "text", text }));
    if (part.type === "tool-call" && (isCardTool(part.toolName) || part.approval)) {
      return [{ kind: "tool", part }];
    }
    return [];
  });

const typingTime = (said: Said | undefined) =>
  said?.kind === "text" ? Math.min(500 + said.text.length * 12, 2000) : 300;

const usePaced = (said: Said[], ready: number, running: boolean) => {
  const [shown, setShown] = useState(running ? ready : Infinity);
  const shownAt = useRef(Date.now());
  const waiting = shown < ready;
  const wait = typingTime(said[shown]);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(
      () => {
        shownAt.current = Date.now();
        setShown((count) => count + 1);
      },
      Math.max(wait - (Date.now() - shownAt.current), 0),
    );
    return () => clearTimeout(timer);
  }, [shown, waiting, wait]);
  return shown;
};

const Bubble: FC<{ said: Said }> = ({ said }) => {
  if (said.kind === "text") {
    return (
      <TextMessagePartProvider text={said.text}>
        <div className="bot-bubble">
          <MarkdownText citations={false} />
        </div>
      </TextMessagePartProvider>
    );
  }
  const { toolName, args, result } = said.part;
  if (currentToolName(toolName) === "clarifying_questions") return <AskCard args={args} />;
  return (
    <>
      {said.part.approval && <ConfirmCard call={said.part} />}
      <AutomationCard tool={toolName} result={result} />
    </>
  );
};

const TypingDots: FC = () => {
  const t = useT();
  return (
    <div role="status" className="bot-bubble flex items-center gap-1 !px-4 !py-3.5">
      <span className="sr-only">{t("Typing…")}</span>
      {["delay-0", "delay-150", "delay-300"].map((delay) => (
        <span
          key={delay}
          className={cn("bg-muted-foreground size-1.5 animate-pulse rounded-full", delay)}
        />
      ))}
    </div>
  );
};

const BotActions: FC = () => {
  const { feedback, rate, copy } = useAnswer();
  const [reporting, setReporting] = useState(false);
  const t = useT();
  return (
    <div className="-ms-1 flex opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100 print:hidden">
      <button
        type="button"
        aria-label={t("Helpful")}
        aria-pressed={feedback === "up"}
        onClick={() => rate(feedback === "up" ? null : "up")}
        className={cn(actionButton, feedback === "up" && "text-foreground")}
      >
        <HugeiconsIcon icon={ThumbsUpIcon} className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("Not helpful")}
        aria-pressed={feedback === "down"}
        onClick={() => (feedback === "down" ? rate(null) : setReporting(true))}
        className={cn(actionButton, feedback === "down" && "text-foreground")}
      >
        <HugeiconsIcon icon={ThumbsDownIcon} className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("Copy response")}
        onClick={() => void copy()}
        className={actionButton}
      >
        <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
      </button>
      <ReportMistake
        open={reporting}
        onOpenChange={setReporting}
        onSend={(report) => rate("down", report)}
      />
    </div>
  );
};

const BotSays: FC = () => {
  const content = useAuiState((s) => s.message.content);
  const running = useAuiState((s) => s.message.status?.type === "running");
  const sources = sourcesOf(content);
  const said = saidOf(content);
  const last = content.at(-1);
  const streaming = running && last?.type === "text" && last.text.trim() !== "";
  const shown = usePaced(said, said.length - (streaming ? 1 : 0), running);
  return (
    <SourcesContext value={new Map(sources.map((source) => [source.url, source]))}>
      <div className="flex flex-col items-start pt-2">
        {said.slice(0, shown).map((item, index) => (
          <Bubble key={index} said={item} />
        ))}
        {running || shown < said.length ? <TypingDots /> : <BotActions />}
        <ReplyError />
      </div>
    </SourcesContext>
  );
};

const BotYou: FC = () => {
  const t = useT();
  const routine = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.routine,
  );
  if (routine) {
    return (
      <p className="text-muted-foreground pt-6 pb-1 text-center text-xs">
        {t("Routine")} · {routine}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2 pt-6 pb-2">
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
      <div className="max-w-4/5 rounded-3xl bg-sky-700 px-4 py-2 text-base text-white wrap-break-word whitespace-pre-wrap">
        <MessagePrimitive.Parts components={{ Text: UserText }} />
      </div>
    </div>
  );
};

export const BotTurn: FC = () => {
  const role = useAuiState((s) => s.message.role);
  return (
    <MessagePrimitive.Root className="group/message">
      {role === "user" ? <BotYou /> : role === "assistant" ? <BotSays /> : null}
    </MessagePrimitive.Root>
  );
};
