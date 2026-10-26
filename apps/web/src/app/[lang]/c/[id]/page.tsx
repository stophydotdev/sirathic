"use client";

import { useParams } from "next/navigation";
import { type ChatMessage } from "@sirathic/server/messages";
import { useEffect, useState } from "react";
import { ThreadSkeleton } from "@/components/thread";
import { Chat, isAnswering, savedChat } from "@/components/chat";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [saved, setSaved] = useState<{ messages: ChatMessage[]; unfinished: boolean }>();
  const [resumed] = useState(() => isAnswering(id));

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
