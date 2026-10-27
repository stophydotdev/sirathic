"use client";

import { useT } from "@/components/i18n";
import { ANSWER_MAX, question } from "@sirathic/server/messages";
import { type ThreadMessage, useAui, useAuiState } from "@assistant-ui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
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
  const closed = dismissed || reply !== undefined;
  const answer = !dismissed && reply && reply.length <= ANSWER_MAX ? reply : undefined;

  return (
    <div className="border-foreground/10 bg-background flex w-full max-w-lg flex-col rounded-3xl border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 py-px text-sm leading-snug font-semibold tracking-tight">
          {asked}
        </p>
        {closed ? (
          <span className="bg-foreground/8 text-muted-foreground flex h-8 max-w-1/2 min-w-28 shrink-0 items-center justify-center gap-1 self-center rounded-full px-2.5 text-sm leading-snug font-semibold">
            {answer ? (
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4.5 shrink-0" />
            ) : (
              <HugeiconsIcon icon={CancelCircleIcon} className="size-4.5 shrink-0" />
            )}
            <span className="truncate">{answer ?? t("Dismissed")}</span>
          </span>
        ) : (
          <button
            type="button"
            aria-label={t("Close")}
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground -me-1 rounded-full p-1"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        )}
      </div>
      {!closed && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            {options.map((option, index) => (
              <button
                key={option}
                type="button"
                disabled={running}
                onClick={() => aui.thread().append(option)}
                className="bg-foreground/8 hover:bg-foreground/12 flex min-h-11 w-full items-center gap-2.5 rounded px-3 py-3 text-start text-sm leading-snug first:rounded-t-xl last:rounded-b-xl disabled:opacity-50"
              >
                <span className="bg-foreground/8 text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-md text-xs">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
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
              className="placeholder:text-muted-foreground h-8.5 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              disabled={running || !own.trim()}
              className="bg-foreground text-background h-8 shrink-0 rounded-full px-2.5 text-sm font-medium disabled:opacity-50"
            >
              {t("Submit")}
            </button>
          </form>
        </div>
      )}
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
  return (
    <div className="my-3">
      <QuestionCard question={asked.question} options={asked.options} reply={reply} />
    </div>
  );
};

export const useFirstReply = () =>
  useAuiState((s) => textOf(s.thread.messages.find((message) => message.role === "user")));
