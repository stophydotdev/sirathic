"use client";

import { type ChatMessage, chatData, messageMetadata } from "@sirathic/server/messages";
import { validateUIMessages } from "ai";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Chat, isLive } from "@/components/chat";
import { ThreadSkeleton } from "@/components/thread";
import { api } from "@/lib/trpc";

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>();

  useEffect(() => {
    if (isLive(id)) return;
    let current = true;
    api.sessions.get
      .query({ id })
      .then(({ messages: found }) =>
        validateUIMessages<ChatMessage>({
          messages: found,
          dataSchemas: chatData,
          metadataSchema: messageMetadata,
        }),
      )
      .then(
        (valid) => {
          if (current) setMessages(valid);
        },
        () => {
          if (current) window.location.replace("/");
        },
      );
    return () => {
      current = false;
    };
  }, [id]);

  return messages || isLive(id) ? (
    <Chat key={id} id={id} initialMessages={messages} />
  ) : (
    <ThreadSkeleton />
  );
}
