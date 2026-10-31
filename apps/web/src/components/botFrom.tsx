"use client";

import { BotAvatar, tintOf } from "@/components/botAvatar";
import { useProjects } from "@/components/projects";
import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/markdownText";
import { TextMessagePartProvider } from "@assistant-ui/react";
import type { FC } from "react";

export const SenderLine: FC<{ from: { id: string; name: string } }> = ({ from }) => {
  const sender = useProjects((s) => s.bots?.find((bot) => bot.id === from.id));
  return (
    <p
      className={cn(
        "ms-1 mb-1 flex items-center gap-1.5 text-xs font-medium",
        tintOf(sender?.color ?? null).text,
      )}
    >
      <BotAvatar
        color={sender?.color ?? null}
        body={sender?.symbol ?? null}
        seed={from.id}
        state="ready"
        className="size-4"
      />
      {sender?.name ?? from.name}
    </p>
  );
};

export const BotFrom: FC<{ from: { id: string; name: string }; text: string }> = ({
  from,
  text,
}) => {
  return (
    <div className="flex flex-col items-start pt-4 pb-2">
      <SenderLine from={from} />
      <div className="min-w-0 max-w-9/10">
        <TextMessagePartProvider text={text} isRunning={false}>
          <div className="bot-bubble">
            <MarkdownText citations={false} />
          </div>
        </TextMessagePartProvider>
      </div>
    </div>
  );
};
