"use client";

import { useAccount } from "@/components/account";
import { BotAvatar } from "@/components/botAvatar";
import { BotMenu } from "@/components/botMenu";
import { useBotPanel } from "@/components/botSettings";
import { useChatState } from "@/components/chat";
import { Composer } from "@/components/composer";
import { useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { QuestionCard, useFirstReply } from "@/components/questionCard";
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

export const BotTitle: FC = () => {
  const bot = useBot();
  const open = useBotPanel((s) => s.open);
  const setOpen = useBotPanel((s) => s.setOpen);
  const t = useT();
  if (!bot) return null;
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={() => setOpen(!open)}
      title={t("Settings")}
      className="bg-muted hover:bg-foreground/10 flex h-8 min-w-0 items-center gap-2 rounded-xl px-2.5 text-sm font-medium"
    >
      <BotAvatar color={bot.color} icon={bot.symbol} className="size-5" />
      <span className="max-w-40 truncate">{bot.name}</span>
    </button>
  );
};

export const BotHeaderMenu: FC = () => {
  const bot = useBot();
  const [open, setOpen] = useState(false);
  if (!bot) return null;
  return (
    <BotMenu
      bot={bot}
      open={open}
      onOpenChange={setOpen}
      className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-xl"
    />
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
      {bot.question && bot.options ? (
        <QuestionCard question={bot.question} options={bot.options} reply={reply} />
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

  useEffect(() => {
    const previous = document.title;
    document.title = `${bot.name} - Sirathic`;
    return () => {
      document.title = previous;
    };
  }, [bot.name]);

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
          <p className="text-muted-foreground mt-2 text-center text-xs">
            {t("Sirathic can make mistakes. Check the sources.")}
          </p>
        </div>
      </div>
    </div>
  );
};
