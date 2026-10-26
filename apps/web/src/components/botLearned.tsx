"use client";

import { useBot } from "@/components/botHome";
import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { api } from "@/lib/trpc";
import { REVIEW_EVERY } from "@sirathic/server/projects";
import { type FC, useEffect, useRef, useState } from "react";

const LOOK_AFTER_MS = [4_000, 9_000, 16_000];

export const BotLearned: FC = () => {
  const bot = useBot();
  const botId = bot?.id;
  const chat = useChatState()?.chat;
  const refresh = useProjects((s) => s.refresh);
  const t = useT();
  const [learned, setLearned] = useState<Awaited<ReturnType<typeof api.notes.learned.query>>>(null);
  const status = chat?.status;
  const downs = chat?.messages.filter((message) => message.metadata?.feedback === "down").length;
  const turns = chat?.messages.filter((message) => message.role === "user").length ?? 0;
  const seenDowns = useRef(downs);

  const look = (id: string) =>
    api.notes.learned
      .query({ botId: id })
      .then(setLearned)
      .catch(() => undefined);

  useEffect(() => {
    if (botId) void look(botId);
  }, [botId, bot?.note]);

  useEffect(() => {
    if (status && status !== "ready") setLearned(null);
  }, [status]);

  useEffect(() => {
    const rated = (downs ?? 0) > (seenDowns.current ?? 0);
    seenDowns.current = downs;
    if (!botId || status !== "ready" || !(rated || (turns > 0 && turns % REVIEW_EVERY === 0))) {
      return;
    }
    const timers = LOOK_AFTER_MS.map((ms) => setTimeout(() => void look(botId), ms));
    return () => timers.forEach(clearTimeout);
  }, [botId, status, downs, turns]);

  if (!botId || !learned) return null;
  const undo = async () => {
    setLearned(null);
    await api.notes.undo.mutate({ botId, id: learned.id }).catch(() => undefined);
    await refresh();
  };
  return (
    <p className="text-muted-foreground mt-1 mb-4 flex items-center gap-2 text-[13px]">
      <span className="min-w-0 truncate">{t("Learned: {reason}", { reason: learned.reason })}</span>
      <button
        type="button"
        onClick={() => void undo()}
        className="hover:text-foreground shrink-0 underline"
      >
        {t("Undo")}
      </button>
    </p>
  );
};
