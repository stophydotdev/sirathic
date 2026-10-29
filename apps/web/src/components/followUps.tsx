"use client";

import { useT } from "@/components/i18n";
import { TooltipIconButton } from "@/components/tooltipIconButton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import type { FC } from "react";
import { create } from "zustand";

const useFollowUps = create<{ byChat: Record<string, readonly string[]> }>(() => ({ byChat: {} }));

const setQueued = (chatId: string, queued: readonly string[]) =>
  useFollowUps.setState(({ byChat }) => ({ byChat: { ...byChat, [chatId]: queued } }));

const queuedIn = (chatId: string) => useFollowUps.getState().byChat[chatId] ?? [];

export const queueFollowUp = (chatId: string, text: string) =>
  setQueued(chatId, [...queuedIn(chatId), text]);

export const nextFollowUp = (chatId: string) => {
  const queued = queuedIn(chatId);
  const next = queued.at(0);
  if (next !== undefined) setQueued(chatId, queued.slice(1));
  return next;
};

const dropFollowUp = (chatId: string, index: number) =>
  setQueued(
    chatId,
    queuedIn(chatId).filter((_, at) => at !== index),
  );

export const QueuedFollowUps: FC<{ chatId: string; onEdit: (text: string) => void }> = ({
  chatId,
  onEdit,
}) => {
  const queued = useFollowUps((s) => s.byChat[chatId]);
  const t = useT();
  if (!queued?.length) return null;
  return (
    <ul aria-label={t("Queued")} className="mb-2 flex flex-col gap-1">
      {queued.map((text, index) => (
        <li
          key={`${index}:${text}`}
          className="bg-card border-foreground/10 flex items-center gap-2 rounded-2xl border py-1.5 ps-3 pe-1.5 text-sm"
        >
          <span className="text-muted-foreground shrink-0 text-xs">{t("Queued")}</span>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <TooltipIconButton
            tooltip={t("Edit")}
            onClick={() => {
              dropFollowUp(chatId, index);
              onEdit(text);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-3.5" />
          </TooltipIconButton>
          <TooltipIconButton
            tooltip={t("Remove")}
            onClick={() => dropFollowUp(chatId, index)}
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </TooltipIconButton>
        </li>
      ))}
    </ul>
  );
};
