"use client";

import { type ChatMessage } from "@sirathic/server/messages";
import { TRPCClientError } from "@trpc/client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Chat, isAnswering, savedChat } from "@/components/chat";
import { ThreadSkeleton } from "@/components/thread";

const NO_MESSAGES = { messages: [], unfinished: false };

export default function BotPage() {
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
      (err: Error) => {
        if (!current) return;
        if (err instanceof TRPCClientError && err.data?.code === "NOT_FOUND") setSaved(NO_MESSAGES);
        else window.location.replace("/");
      },
    );
    return () => {
      current = false;
    };
  }, [id, resumed]);

  return saved || resumed ? (
    <Chat
      key={id}
      id={id}
      projectId={id}
      initialMessages={saved?.messages}
      unfinished={saved?.unfinished}
      home={`/bot/${id}`}
    />
  ) : (
    <ThreadSkeleton />
  );
}
