"use client";

import { type ChatMessage } from "@sirathic/server/messages";
import { TRPCClientError } from "@trpc/client";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Chat,
  isAnswering,
  keptMessages,
  outdated,
  prefetchedMessages,
  savedChat,
} from "@/components/chat";
import { EmptyThread } from "@/components/thread";

const NO_MESSAGES = { messages: [], unfinished: false };

export default function BotPage() {
  const { id } = useParams<{ id: string }>();
  const home = usePathname();
  const [kept, setKept] = useState(() => keptMessages(id));
  const [saved, setSaved] = useState<{ messages: ChatMessage[]; unfinished: boolean }>();
  const [resumed] = useState(() => isAnswering(id));

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

  const shown = saved ?? (kept && { messages: kept, unfinished: false });
  const changed = saved && kept && outdated(kept, saved.messages);
  return shown || resumed ? (
    <Chat
      key={changed ? `${id}:saved` : id}
      id={id}
      projectId={id}
      initialMessages={shown?.messages}
      unfinished={shown?.unfinished}
      home={home}
    />
  ) : (
    <EmptyThread />
  );
}
