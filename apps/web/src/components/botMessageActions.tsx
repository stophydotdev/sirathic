"use client";

import { actionButton, useAnswer } from "@/components/answerActions";
import { BotReactionPicker } from "@/components/botReactionPicker";
import { useBotReply } from "@/components/botReply";
import { useChatState } from "@/components/chat";
import { useLocale, useT } from "@/components/i18n";
import { ReportMistake } from "@/components/reportMistake";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { messageMetadata } from "@sirathic/server/messages";
import { type ThreadMessage, useAui, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowTurnBackwardIcon,
  Copy01Icon,
  MoreHorizontalIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";

const useReaction = () => {
  const chat = useChatState();
  const messageId = useAuiState((s) => s.message.id);
  const disabled = useAuiState((s) => s.thread.isRunning);
  const reaction = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.reaction,
  );
  const setReaction = (emoji: string | undefined) => {
    if (!chat || disabled) return;
    chat.chat.setMessages((messages) =>
      messages.map((message) => {
        if (message.id !== messageId) return message;
        const { reaction: _old, ...metadata } = message.metadata ?? {};
        return { ...message, metadata: emoji ? { ...metadata, reaction: emoji } : metadata };
      }),
    );
    if (chat.saved) {
      void api.sessions.react.mutate({ id: chat.id, messageId, emoji }).catch(() => undefined);
    }
  };
  return { reaction, setReaction, disabled };
};

export const BotReactions: FC<{ botReaction?: string; user?: boolean }> = ({
  botReaction,
  user,
}) => {
  const { reaction, setReaction, disabled } = useReaction();
  const t = useT();
  if (!reaction && !botReaction) return null;
  return (
    <div className={cn("absolute -bottom-3 flex gap-1", user ? "end-2" : "start-2")}>
      {botReaction && (
        <span
          role="img"
          aria-label={botReaction}
          className="bg-background border-border rounded-full border px-1.5 py-0.5 text-sm leading-none"
        >
          {botReaction}
        </span>
      )}
      {reaction && (
        <button
          type="button"
          aria-label={t("Remove reaction")}
          title={t("Remove reaction")}
          onClick={() => setReaction(undefined)}
          disabled={disabled}
          className="bg-background border-border hover:bg-muted focus-visible:ring-ring rounded-full border px-1.5 py-0.5 text-sm leading-none outline-none focus-visible:ring-2"
        >
          {reaction}
        </button>
      )}
    </div>
  );
};

export const sentAt = (messages: readonly ThreadMessage[], message: ThreadMessage) => {
  const reply = messages[messages.indexOf(message) + 1];
  const replied =
    reply?.role === "assistant"
      ? messageMetadata.safeParse(reply.metadata.custom).data?.createdAt
      : undefined;
  return replied ?? message.createdAt.getTime();
};

const MessageMoreMenu: FC = () => {
  const { feedback, rate, copy } = useAnswer();
  const [reporting, setReporting] = useState(false);
  const message = useAuiState((s) => s.message);
  const messages = useAuiState((s) => s.thread.messages);
  const running = message.status?.type === "running";
  const t = useT();
  const locale = useLocale();
  const at =
    message.role === "user"
      ? sentAt(messages, message)
      : (messageMetadata.safeParse(message.metadata.custom).data?.createdAt ??
        message.createdAt.getTime());
  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              aria-label={t("More actions")}
              className={cn(actionButton, "transition-none")}
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="animate-none!" side="top">
            {t("More actions")}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-48 animate-none!">
          <DropdownMenuLabel className="font-normal">
            {new Intl.DateTimeFormat(locale, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(at)}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void copy()}>
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            {t("Copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigator.clipboard.writeText(message.id)}>
            <HugeiconsIcon icon={Copy01Icon} className="size-4" />
            {t("Copy request ID")}
          </DropdownMenuItem>
          {message.role === "assistant" && (
            <>
              <DropdownMenuItem
                disabled={running}
                onSelect={() => rate(feedback === "up" ? null : "up")}
              >
                <HugeiconsIcon icon={ThumbsUpIcon} className="size-4" />
                {t("Helpful")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={running}
                onSelect={() => (feedback === "down" ? rate(null) : setReporting(true))}
              >
                <HugeiconsIcon icon={ThumbsDownIcon} className="size-4" />
                {t("Not helpful")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportMistake
        open={reporting}
        onOpenChange={setReporting}
        onSend={(report) => rate("down", report)}
      />
    </>
  );
};

export const BotMessageActions: FC<{ text: string; touch?: boolean }> = ({
  text,
  touch = false,
}) => {
  const chat = useChatState();
  const aui = useAui();
  const { reaction, setReaction, disabled } = useReaction();
  const t = useT();
  return (
    <TooltipProvider>
      <div
        className={cn(
          "pointer-events-none flex shrink-0 gap-0.5 opacity-0 group-focus-within/bubble:pointer-events-auto group-focus-within/bubble:opacity-100 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100 print:hidden",
          touch && "pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
        )}
      >
        <BotReactionPicker
          disabled={disabled}
          reaction={reaction}
          onPick={(emoji) => setReaction(emoji === reaction ? undefined : emoji)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t("Reply")}
              className={cn(actionButton, "transition-none")}
              onClick={() => {
                if (!chat) return;
                const quote = { text, messageId: aui.message().getState().id };
                useBotReply.setState(({ byChat }) => ({ byChat: { ...byChat, [chat.id]: quote } }));
                aui.thread().composer().setQuote(quote);
              }}
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4 rtl:-scale-x-100" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="animate-none!" side="top">
            {t("Reply")}
          </TooltipContent>
        </Tooltip>
        <MessageMoreMenu />
      </div>
    </TooltipProvider>
  );
};
