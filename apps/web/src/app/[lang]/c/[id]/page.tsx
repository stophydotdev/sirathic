"use client";

import { type ChatMessage } from "@sirathic/server/messages";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Chat,
  isAnswering,
  keptMessages,
  outdated,
  prefetchedMessages,
  savedChat,
} from "@/components/chat";
import { useProjects } from "@/components/projects";
import { EmptyThread } from "@/components/thread";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [kept, setKept] = useState(() => keptMessages(id));
  const [saved, setSaved] = useState<{ messages: ChatMessage[]; unfinished: boolean }>();
  const [resumed] = useState(() => isAnswering(id));
  const isBot = useProjects((s) => s.bots?.some((bot) => bot.id === id));
  const router = useRouter();

  useEffect(() => {
    if (isBot) router.replace(`/bot/${id}`);
  }, [isBot, id, router]);

  useEffect(() => {
    if (resumed) return;
    let current = true;
    let fresh = false;
    void prefetchedMessages(id)?.then((found) => {
      if (current && !fresh && found) setKept((shown) => shown ?? found);
    });
    savedChat(id).then(
      (found) => {
        fresh = true;
        if (current) setSaved(found);
      },
      () => {
        if (current) window.location.replace("/");
      },
    );
    return () => {
      current = false;
    };
  }, [id, resumed]);

  const shown = saved ?? (kept && { messages: kept, unfinished: false });
  const changed = saved && kept && outdated(kept, saved.messages);
  return shown || resumed ? (
    <Chat
      key={changed ? `${id}:saved` : id}
      id={id}
      initialMessages={shown?.messages}
      unfinished={shown?.unfinished}
    />
  ) : (
    <EmptyThread />
  );
}
