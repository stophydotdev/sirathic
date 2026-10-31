"use client";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";
import { type TODO_STATUSES, todoList } from "@sirathic/server/cards";
import { currentToolName } from "@sirathic/server/messages";
import { useAuiState } from "@assistant-ui/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FC } from "react";

type Status = (typeof TODO_STATUSES)[number];

const RING = {
  pending: "border-foreground/30",
  in_progress: "border-foreground",
  completed: "bg-foreground text-background border-transparent",
  cancelled: "border-foreground/15",
} satisfies Record<Status, string>;

const TEXT = {
  pending: "text-muted-foreground",
  in_progress: "shimmer",
  completed: "",
  cancelled: "text-muted-foreground/70 line-through",
} satisfies Record<Status, string>;

export const TodoCard: FC<{ callId: string; result: unknown }> = ({ callId, result }) => {
  const latest = useAuiState((s) =>
    s.thread.messages
      .flatMap((message) => (message.role === "assistant" ? message.content : []))
      .flatMap((part) =>
        part.type === "tool-call" &&
        currentToolName(part.toolName) === "todo_write" &&
        todoList.safeParse(part.result).success
          ? [part.toolCallId]
          : [],
      )
      .at(-1),
  );
  const shown = todoList.safeParse(result).data;
  const t = useT();
  if (!shown || latest !== callId) return null;
  const done = shown.todos.filter((item) => item.status === "completed").length;

  return (
    <div className="bg-foreground/7 my-4 rounded-3xl p-4 print:hidden">
      <p className="text-muted-foreground mb-3 text-sm tabular-nums">
        {t("{done} of {count} done", { done, count: shown.todos.length })}
      </p>
      <ul className="flex flex-col gap-2">
        {shown.todos.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                RING[item.status],
              )}
            >
              {item.status === "completed" && (
                <HugeiconsIcon icon={Tick02Icon} className="size-3" />
              )}
            </span>
            <span className={cn("min-w-0", TEXT[item.status])}>{item.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
