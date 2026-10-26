"use client";

import { type ChatMessage } from "@sirathic/server/messages";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThreadSkeleton } from "@/components/thread";
import { Chat, isAnswering, savedChat } from "@/components/chat";
import { useProjects } from "@/components/projects";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
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
    savedChat(id).then(
      (found) => {
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

  return saved || resumed ? (
    <Chat key={id} id={id} initialMessages={saved?.messages} unfinished={saved?.unfinished} />
  ) : (
    <ThreadSkeleton />
  );
}
