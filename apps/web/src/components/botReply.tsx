"use client";

import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import { type QuoteInfo, useAui, useAuiEvent } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowTurnBackwardIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { type FC, useEffect } from "react";
import { create } from "zustand";

export const useBotReply = create<{ byChat: Record<string, QuoteInfo | undefined> }>(() => ({
  byChat: {},
}));

export const BotReply: FC = () => {
  const chat = useChatState();
  const chatId = chat?.id;
  const aui = useAui();
  const quote = useBotReply((s) => (chatId ? s.byChat[chatId] : undefined));
  const t = useT();
  useEffect(() => {
    if (!chatId || aui.thread().composer().getState().quote !== undefined) return;
    aui.thread().composer().setQuote(useBotReply.getState().byChat[chatId]);
  }, [aui, chatId]);
  useAuiEvent({ scope: "thread", event: "composer.send" }, ({ messageId }) => {
    if (
      !chatId ||
      chat.projectId !== chatId ||
      messageId !== undefined ||
      aui.thread().composer().getState().quote !== undefined
    )
      return;
    useBotReply.setState(({ byChat }) => ({ byChat: { ...byChat, [chatId]: undefined } }));
  });
  if (!chatId || quote === undefined) return null;
  return (
    <div className="bg-card border-foreground/10 mb-2 flex items-center gap-2 rounded-2xl border py-1.5 ps-3 pe-1.5 text-sm">
      <HugeiconsIcon
        icon={ArrowTurnBackwardIcon}
        className="text-muted-foreground size-4 shrink-0 rtl:-scale-x-100"
      />
      <span className="min-w-0 flex-1 truncate">{quote.text.split(/\r?\n/u)[0]}</span>
      <button
        type="button"
        aria-label={t("Clear reply")}
        title={t("Clear reply")}
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring grid size-7 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-2"
        onClick={() => {
          aui.thread().composer().setQuote(undefined);
          useBotReply.setState(({ byChat }) => ({ byChat: { ...byChat, [chatId]: undefined } }));
        }}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
      </button>
    </div>
  );
};
