"use client";

import { AnswerCard, MemoryUsed } from "@/components/answerCard";
import { BotMessageActions, BotReactions, sentAt } from "@/components/botMessageActions";
import { splitQuote } from "@sirathic/app/botQuote";
import { ReplyError } from "@/components/answer";
import { AutomationCard, isCardTool } from "@/components/automationCard";
import { bubblesOf } from "@sirathic/app/botBubbles";
import { tintOf } from "@/components/botAvatar";
import { BotEvent, isBotEvent } from "@/components/botEvents";
import { useBot } from "@/components/botHome";
import { FormCard, HelpCard } from "@/components/browserCards";
import { STAMP_GAP, stampText } from "@/components/botStamp";
import { AttachmentChip } from "@/components/composer";
import { FILE_TOOLS, FileResult } from "@/components/fileCards";
import { ScreenshotCard, shownScreenshot } from "@/components/botScreenshot";
import { savedFiles } from "@sirathic/server/files";
import { useLocale, useT } from "@/components/i18n";
import { MarkdownText } from "@/components/markdownText";
import { UserText } from "@/components/mentions";
import { ConfirmCard } from "@/components/confirmCard";
import { AskCard } from "@/components/questionCard";
import { SourcesContext, siteName, sourcesOf } from "@/components/sources";
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
import type { Source } from "@sirathic/server/sources";
import { type FC, Fragment, useEffect, useRef, useState } from "react";
import { z } from "zod";

type Part = ThreadMessage["content"][number];

type Said =
  | { kind: "text"; text: string }
  | { kind: "tool"; part: Extract<Part, { type: "tool-call" }> };

const shows = (part: Extract<Part, { type: "tool-call" }>) =>
  shownScreenshot.safeParse(part.result).success ||
  (part.toolName === "code_execution" &&
    (savedFiles.safeParse(part.result).data?.files.length ?? 0) > 0);

const saidOf = (content: ThreadMessage["content"]) =>
  content
    .flatMap<Said>((part) => {
      if (part.type === "text") return bubblesOf(part.text).map((text) => ({ kind: "text", text }));
      if (
        part.type === "tool-call" &&
        (isCardTool(part.toolName) || isBotEvent(part.toolName) || part.approval || shows(part))
      ) {
        return [{ kind: "tool", part }];
      }
      return [];
    })
    .filter((item, index, all) => !(isMemoryWrite(item) && isMemoryWrite(all[index - 1])));

const isMemoryWrite = (said: Said | undefined) =>
  said?.kind === "tool" && currentToolName(said.part.toolName) === "update_memory";

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

const BotText: FC<{ text: string; last: boolean }> = ({ text, last }) => {
  const reaction = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.reaction,
  );
  const running = useAuiState((s) => s.message.status?.type === "running");
  return (
    <div
      className={cn(
        "group/bubble mb-2 flex max-w-full items-end gap-1",
        last && reaction && "mb-5",
      )}
    >
      <div className="relative min-w-0 max-w-9/10">
        <TextMessagePartProvider text={text} isRunning={last && running}>
          <div className="bot-bubble">
            <MarkdownText citations={false} />
          </div>
        </TextMessagePartProvider>
        {last && <BotReactions />}
      </div>
      <BotMessageActions text={text} touch={last} />
    </div>
  );
};

const Bubble: FC<{ said: Said; last: boolean }> = ({ said, last }) => {
  if (said.kind === "text") return <BotText text={said.text} last={last} />;
  const { toolName, args, result } = said.part;
  const shot = shownScreenshot.safeParse(result).data;
  if (shot) return <ScreenshotCard shot={shot} />;
  if (currentToolName(toolName) === "clarifying_questions") return <AskCard args={args} />;
  if (currentToolName(toolName) === "request_user_form") {
    return <FormCard args={args} result={result} />;
  }
  if (currentToolName(toolName) === "request_browser_help") return <HelpCard args={args} />;
  return (
    <>
      {said.part.approval && <ConfirmCard call={said.part} />}
      <AutomationCard tool={toolName} result={result} />
      <AnswerCard name={currentToolName(toolName)} args={args} result={result} />
      <BotEvent tool={toolName} result={result} />
      {(FILE_TOOLS.includes(toolName) || toolName === "code_execution") && (
        <FileResult part={said.part} />
      )}
    </>
  );
};

const STEP_LINES = [
  "Searching the Quran…",
  "Searching hadith…",
  "Searching fatwas…",
  "Reading the fiqh books…",
  "Searching the web…",
  "Reading the page…",
  "Calculating…",
  "Setting it up…",
  "Checking Stophy…",
] as const;

type StepLine = (typeof STEP_LINES)[number];

const SEARCH_LINES = new Map<string, StepLine>([
  ["quran", "Searching the Quran…"],
  ["hadith", "Searching hadith…"],
  ["fatwa", "Searching fatwas…"],
  ["fiqh", "Reading the fiqh books…"],
  ["web", "Searching the web…"],
  ["news", "Searching the web…"],
]);

const TOOL_LINES = new Map<string, StepLine>([
  ["fetch_url", "Reading the page…"],
  ["get_verses", "Searching the Quran…"],
  ["code_execution", "Calculating…"],
  ["update_routine", "Setting it up…"],
  ["update_skill", "Setting it up…"],
  ["update_profile", "Setting it up…"],
  ["update_memory", "Setting it up…"],
  ["set_bot_job", "Setting it up…"],
  ["install_plugin", "Setting it up…"],
  ["stophy_search_endpoints", "Checking Stophy…"],
  ["stophy_call", "Checking Stophy…"],
]);

const searched = z.object({ sources: z.array(z.string()) });

const stepLineOf = (part: Extract<Part, { type: "tool-call" }>) =>
  currentToolName(part.toolName) === "search_web"
    ? (searched.safeParse(part.args).data?.sources ?? []).flatMap(
        (source) => SEARCH_LINES.get(source) ?? [],
      )[0]
    : currentToolName(part.toolName).startsWith("browser_")
      ? "Reading the page…"
      : TOOL_LINES.get(currentToolName(part.toolName));

const Working: FC<{ step: StepLine | undefined }> = ({ step }) => {
  const t = useT();
  return (
    <div role="status" className="mb-2 flex flex-col items-start gap-1">
      <span className="sr-only">{t("Typing…")}</span>
      <div aria-hidden className="bot-bubble">
        <span className="flex h-6 items-center gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </div>
      {step && <p className="text-muted-foreground ms-1 text-xs">{t(step)}</p>}
    </div>
  );
};

const SourceLine: FC<{ sources: readonly Source[] }> = ({ sources }) => {
  const t = useT();
  const sites = [...new Map(sources.map((source) => [siteName(source.url), source.url]))].slice(
    0,
    4,
  );
  if (sites.length === 0) return null;
  return (
    <p className="text-muted-foreground mb-2 ms-4 max-w-9/10 text-xs">
      {t("Sources")}:{" "}
      {sites.map(([name, url], index) => (
        <Fragment key={url}>
          {index > 0 && ", "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-super hover:underline"
          >
            {name}
          </a>
        </Fragment>
      ))}
    </p>
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
  const asking = said.some(
    (item) =>
      item.kind === "tool" &&
      item.part.approval &&
      item.part.approval.approved === undefined &&
      item.part.approval.resolution === undefined,
  );
  const working = (running && !asking) || shown < said.length;
  const step = running
    ? content
        .flatMap((part) => (part.type === "tool-call" && part.result === undefined ? [part] : []))
        .at(-1)
    : undefined;
  const lastText = said.findLastIndex((item) => item.kind === "text");
  return (
    <SourcesContext value={new Map(sources.map((source) => [source.url, source]))}>
      <div className="flex flex-col items-start pt-2">
        {said.slice(0, shown).map((item, index) => (
          <Fragment key={index}>
            <Bubble said={item} last={index === lastText} />
            {!working && index === lastText && <SourceLine sources={sources} />}
            {!working && index === lastText && <MemoryUsed />}
          </Fragment>
        ))}
        {working && <Working step={step && stepLineOf(step)} />}
        <ReplyError />
      </div>
    </SourcesContext>
  );
};

const reacted = z.object({ emoji: z.string() });

const reactionAfter = (messages: readonly ThreadMessage[], id: string) => {
  const reply = messages[messages.findIndex((message) => message.id === id) + 1];
  const call = reply?.content.find(
    (part) => part.type === "tool-call" && currentToolName(part.toolName) === "react_to_message",
  );
  return call?.type === "tool-call" ? reacted.safeParse(call.result).data?.emoji : undefined;
};

const stampOf = (messages: readonly ThreadMessage[], id: string) => {
  const message = messages.find((item) => item.id === id);
  if (message?.role !== "user") return undefined;
  if (messageMetadata.safeParse(message.metadata.custom).data?.formReply) return undefined;
  const at = sentAt(messages, message);
  const before = messages.slice(0, messages.indexOf(message)).findLast((m) => m.role === "user");
  return before === undefined || at - sentAt(messages, before) > STAMP_GAP ? at : undefined;
};

const Stamp: FC<{ at: number }> = ({ at }) => {
  const locale = useLocale();
  return (
    <p className="text-muted-foreground pt-8 text-center text-xs first-letter:uppercase">
      {stampText(locale, at, Date.now())}
    </p>
  );
};

const BotUserText: FC<{ text: string }> = ({ text }) => {
  const reply = splitQuote(text);
  return (
    <>
      {reply.quote !== undefined && (
        <p className="mb-1 truncate border-s-2 border-current/40 ps-2 text-sm opacity-90">
          {reply.quote}
        </p>
      )}
      <UserText text={reply.text} />
    </>
  );
};

const BotYou: FC = () => {
  const t = useT();
  const bot = useBot();
  const reaction = useAuiState((s) => reactionAfter(s.thread.messages, s.message.id));
  const ownReaction = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.reaction,
  );
  const text = useAuiState((s) =>
    s.message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n"),
  );
  const routine = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.routine,
  );
  const formReply = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.formReply,
  );
  if (formReply) return null;
  if (routine) {
    return (
      <p className="text-muted-foreground pt-6 pb-1 text-center text-xs">
        {t("Routine")} · {routine}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2 pt-4 pb-2">
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
      <div className="group/bubble flex w-full items-end justify-end gap-1">
        <BotMessageActions text={splitQuote(text).text} />
        <div
          className={cn(
            "relative min-w-0 max-w-4/5 text-base text-white",
            (reaction || ownReaction) && "mb-3",
          )}
        >
          <div
            className={cn(
              "rounded-3xl px-4 py-2 wrap-break-word whitespace-pre-wrap",
              tintOf(bot?.color ?? null).bubble,
            )}
          >
            <MessagePrimitive.Parts components={{ Text: BotUserText }} />
          </div>
          <BotReactions botReaction={reaction} user />
        </div>
      </div>
    </div>
  );
};

export const BotTurn: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const stamp = useAuiState((s) => stampOf(s.thread.messages, s.message.id));
  return (
    <MessagePrimitive.Root
      className="group/message"
      tabIndex={0}
      onPointerDown={(event) => {
        if (
          event.pointerType === "touch" &&
          event.target instanceof Element &&
          event.currentTarget.contains(event.target) &&
          !event.target.closest("button, a, input, textarea, [role=button]")
        )
          event.currentTarget.focus();
      }}
    >
      {stamp !== undefined && <Stamp at={stamp} />}
      {role === "user" ? <BotYou /> : role === "assistant" ? <BotSays /> : null}
    </MessagePrimitive.Root>
  );
};
