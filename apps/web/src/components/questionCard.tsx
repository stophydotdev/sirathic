"use client";

import { useChatState } from "@/components/chat";
import { useLocale, useT } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ANSWER_MAX,
  messageMetadata,
  question,
  type questionAnswer,
} from "@sirathic/server/messages";
import { type ThreadMessage, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";
import type { z } from "zod";

const textOf = (message: ThreadMessage | undefined) =>
  message?.content.map((part) => (part.type === "text" ? part.text : "")).join("");

export const QuestionCard: FC<z.infer<typeof question> & { reply: ThreadMessage | undefined }> = ({
  question: asked,
  options,
  multiple,
  reply,
}) => {
  const running = useAuiState((s) => s.thread.isRunning);
  const [dismissed, setDismissed] = useState(false);
  const [own, setOwn] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const t = useT();
  const locale = useLocale();
  const chat = useChatState();
  const answered = (answer: z.infer<typeof questionAnswer>) => {
    if (!chat?.saved) return;
    void api.events.record
      .mutate({ name: "question.answered", props: { answer } })
      .catch(() => undefined);
  };
  const send = (text: string) =>
    void chat?.chat.sendMessage({ text, metadata: { createdAt: Date.now(), picked: true } });
  const listOf = (parts: string[]) =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(parts);
  const picks = options.filter((option) => picked.includes(option));
  const answer = listOf([...picks, own.trim()].filter((part) => part !== ""));
  const replyText = textOf(reply) ?? "";
  const replied = messageMetadata.safeParse(reply?.metadata.custom).data?.picked === true;
  const matched = options.includes(replyText)
    ? [replyText]
    : options.filter((option) => multiple && replyText.includes(option));
  const chosen = replied ? (listOf(matched) === replyText ? matched : []) : picked;
  if (dismissed || (reply && !replied)) {
    return (
      <div className="my-2 flex flex-col items-start gap-1">
        <p className="bot-bubble">{asked}</p>
        {dismissed && <span className="text-muted-foreground px-4 text-sm">{t("Dismissed")}</span>}
      </div>
    );
  }

  return (
    <div className="bot-card">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 py-px text-sm leading-snug">{asked}</p>
        {!replied && (
          <button
            type="button"
            aria-label={t("Close")}
            onClick={() => {
              setDismissed(true);
              answered("dismissed");
            }}
            className="text-muted-foreground hover:bg-foreground/8 hover:text-foreground -me-1 rounded-full p-1"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-2.5 flex flex-col gap-2.5">
        <div className="border-foreground/10 divide-foreground/10 flex flex-col divide-y overflow-hidden rounded-xl border">
          {(replied ? chosen : options).map((option) => {
            const checked = chosen.includes(option);
            return (
              <button
                key={option}
                type="button"
                role={multiple ? "checkbox" : undefined}
                aria-checked={multiple ? checked : undefined}
                disabled={running || replied}
                onClick={() => {
                  if (multiple) {
                    setPicked(
                      checked ? picked.filter((pick) => pick !== option) : [...picked, option],
                    );
                    return;
                  }
                  send(option);
                  answered("option");
                }}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2.5 px-3 py-2 text-start text-sm leading-snug",
                  !replied && "hover:bg-foreground/8 disabled:opacity-50",
                )}
              >
                <span
                  className={`${checked ? "bg-foreground text-background" : "bg-foreground/10 text-muted-foreground"} inline-flex size-4.5 shrink-0 items-center justify-center rounded-md text-xs`}
                >
                  {String.fromCharCode(65 + options.indexOf(option))}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            );
          })}
          {replied && chosen.length === 0 && (
            <p className="min-h-9 px-3 py-2 text-sm leading-snug">{replyText}</p>
          )}
        </div>
        {!replied && (
          <form
            className="bg-background flex items-center gap-2 rounded-xl ps-3 pe-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (!answer || running) return;
              send(answer);
              answered(picks.length > 0 ? "option" : "own");
              setOwn("");
            }}
          >
            <input
              value={own}
              onChange={(event) => setOwn(event.target.value)}
              maxLength={ANSWER_MAX}
              placeholder={t("Type your own answer")}
              className="placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {(multiple || own.trim()) && (
              <button
                type="submit"
                disabled={running || !answer}
                className="bg-foreground text-background h-7 shrink-0 rounded-full px-3 text-xs font-medium disabled:opacity-50"
              >
                {t("Submit")}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export const AskCard: FC<{ args: unknown }> = ({ args }) => {
  const asked = question.safeParse(args).data;
  const reply = useAuiState((s) => {
    const at = s.thread.messages.findIndex((message) => message.id === s.message.id);
    return s.thread.messages.slice(at + 1).find((message) => message.role === "user");
  });
  if (!asked) return null;
  return <QuestionCard {...asked} reply={reply} />;
};

export const useFirstReply = () =>
  useAuiState((s) => s.thread.messages.find((message) => message.role === "user"));
