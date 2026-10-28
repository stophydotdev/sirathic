"use client";

import { useT } from "@/components/i18n";
import { ANSWER_MAX, question } from "@sirathic/server/messages";
import { type ThreadMessage, useAui, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";

const textOf = (message: ThreadMessage | undefined) =>
  message?.content.map((part) => (part.type === "text" ? part.text : "")).join("");

export const QuestionCard: FC<{
  question: string;
  options: readonly string[];
  reply: string | undefined;
}> = ({ question: asked, options, reply }) => {
  const aui = useAui();
  const running = useAuiState((s) => s.thread.isRunning);
  const [dismissed, setDismissed] = useState(false);
  const [own, setOwn] = useState("");
  const t = useT();
  if (dismissed || reply !== undefined) {
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
        <p className="min-w-0 flex-1 py-px text-base leading-snug">{asked}</p>
        <button
          type="button"
          aria-label={t("Close")}
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:bg-foreground/8 hover:text-foreground -me-1 rounded-full p-1"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <div className="border-foreground/10 divide-foreground/10 flex flex-col divide-y overflow-hidden rounded-xl border">
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              disabled={running}
              onClick={() => aui.thread().append(option)}
              className="hover:bg-foreground/8 flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-start text-base leading-snug disabled:opacity-50"
            >
              <span className="bg-foreground/10 text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-md text-xs">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          ))}
        </div>
        <form
          className="bg-background flex items-center gap-2 rounded-xl ps-4 pe-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const text = own.trim();
            if (!text || running) return;
            aui.thread().append(text);
            setOwn("");
          }}
        >
          <input
            value={own}
            onChange={(event) => setOwn(event.target.value)}
            maxLength={ANSWER_MAX}
            placeholder={t("Type your own answer")}
            className="placeholder:text-muted-foreground h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {own.trim() && (
            <button
              type="submit"
              disabled={running}
              className="bg-foreground text-background h-8 shrink-0 rounded-full px-3 text-sm font-medium disabled:opacity-50"
            >
              {t("Submit")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export const AskCard: FC<{ args: unknown }> = ({ args }) => {
  const asked = question.safeParse(args).data;
  const reply = useAuiState((s) => {
    const at = s.thread.messages.findIndex((message) => message.id === s.message.id);
    return textOf(s.thread.messages.slice(at + 1).find((message) => message.role === "user"));
  });
  if (!asked) return null;
  return <QuestionCard question={asked.question} options={asked.options} reply={reply} />;
};

export const useFirstReply = () =>
  useAuiState((s) => textOf(s.thread.messages.find((message) => message.role === "user")));
