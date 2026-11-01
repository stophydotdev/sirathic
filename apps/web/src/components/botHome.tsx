"use client";

import { useAccount } from "@/components/account";
import { BotAvatar } from "@/components/botAvatar";
import { BotMenu } from "@/components/botMenu";
import { useBotProfile } from "@/components/botProfile";
import { useBotPanel } from "@/components/botSettings";
import { useChatState } from "@/components/chat";
import { Composer } from "@/components/composer";
import { useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { QuestionCard, useFirstReply } from "@/components/questionCard";
import type { BlobState } from "@sirathic/app/blob/states";
import { useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon } from "@hugeicons/core-free-icons";
import { currentToolName } from "@sirathic/server/messages";
import { type FC, useEffect, useState } from "react";

const STARTER_REPLIES = [
  "Study the Quran with me, a few verses a day",
  "Teach me one hadith a day",
  "Teach me Quranic Arabic",
  "Coach me through Ramadan",
  "Tell my kids stories of the prophets",
  "Guide me as a new Muslim",
  "Answer my fiqh questions by my madhab",
] as const;

export const useBot = () => {
  const projectId = useChatState()?.projectId;
  return useProjects((s) => s.bots?.find((bot) => bot.id === projectId));
};

const useBotState = () =>
  useAuiState((s): BlobState => {
    const last = s.thread.messages.at(-1);
    if (last?.role !== "assistant") return s.thread.isRunning ? "thinking" : "ready";
    if (last.status?.type === "incomplete" && last.status.reason === "error") return "failed";
    if (last.status?.type === "incomplete" && last.status.reason === "cancelled") return "stopped";
    const open = last.content.filter(
      (part) => part.type === "tool-call" && part.result === undefined,
    );
    const asking = open.some(
      (part) =>
        part.type === "tool-call" &&
        ((part.approval !== undefined &&
          part.approval.approved === undefined &&
          part.approval.resolution === undefined) ||
          currentToolName(part.toolName) === "clarifying_questions"),
    );
    if (asking) return "asking";
    if (!s.thread.isRunning) return "ready";
    if (
      open.some(
        (part) => part.type === "tool-call" && currentToolName(part.toolName) === "search_web",
      )
    )
      return "searching";
    if (open.length > 0) return "working";
    return last.content.at(-1)?.type === "text" ? "writing" : "thinking";
  });

export const BotTitle: FC = () => {
  const bot = useBot();
  const state = useBotState();
  const t = useT();
  if (!bot) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => useBotProfile.getState().setOpen(true)}
      title={t("Edit profile")}
      className="bg-muted hover:bg-foreground/10 flex h-8 min-w-0 items-center gap-2 rounded-xl px-2.5 text-sm font-medium"
    >
      <BotAvatar
        color={bot.color}
        body={bot.symbol}
        seed={bot.id}
        state={state}
        className="size-5"
      />
      <span className="max-w-40 truncate">{bot.name}</span>
    </button>
  );
};

export const BotHeaderMenu: FC = () => {
  const bot = useBot();
  const [open, setOpen] = useState(false);
  const view = useBotPanel((s) => s.view);
  const show = useBotPanel((s) => s.show);
  const t = useT();
  if (!bot) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t("{name}'s screen", { name: bot.name })}
        aria-pressed={view === "screen"}
        onClick={() => show(view === "screen" ? "closed" : "screen")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-foreground/10 aria-pressed:text-foreground flex size-8 shrink-0 items-center justify-center rounded-xl"
      >
        <HugeiconsIcon icon={ComputerIcon} className="size-4.5" />
      </button>
      <BotMenu
        bot={bot}
        open={open}
        onOpenChange={setOpen}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-xl"
      />
    </div>
  );
};

export const BotGreeting: FC = () => {
  const bot = useBot();
  const reply = useFirstReply();
  const t = useT();
  if (!bot) return null;
  return (
    <div className="flex w-full flex-col items-start pt-8">
      <p className="bot-bubble">
        {bot.greeting ??
          t(
            "Assalamu alaikum. What do you want me around for? Anything concrete, or more of a study companion?",
          )}
      </p>
      {bot.options ? (
        <QuestionCard
          question={bot.question ?? t("What should I focus on?")}
          options={bot.options}
          reply={reply}
        />
      ) : (
        (!bot.instructions || reply !== undefined) && (
          <QuestionCard
            question={t("What should I focus on?")}
            options={STARTER_REPLIES.map((starter) => t(starter))}
            reply={reply}
          />
        )
      )}
    </div>
  );
};

export const BotHome: FC<{ bot: Project }> = ({ bot }) => {
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const t = useT();

  useEffect(() => {
    if (signedOut) window.location.replace("/");
  }, [signedOut]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between ps-14 pe-4 lg:ps-4">
        <BotTitle />
        <BotHeaderMenu />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <div className="mx-auto w-full max-w-182 flex-1">
          <BotGreeting />
        </div>
        <div className="bg-background sticky bottom-0 mx-auto w-full max-w-182 pt-4 pb-3">
          <Composer
            placeholder={t("Message {name}", { name: bot.name })}
            menuSide="top"
            bot
            compact
          />
        </div>
      </div>
    </div>
  );
};
