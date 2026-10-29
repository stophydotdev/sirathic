"use client";

import { Chat } from "@/components/chat";
import { useChatOptions } from "@/components/chatOptions";
import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback } from "react";
import { create } from "zustand";

const useFreshChat = create<{ count: number }>(() => ({ count: 0 }));

export const NewChat = () => <Chat key={useFreshChat((s) => s.count)} />;

export function useStartChat() {
  const router = useRouter();
  return useCallback(() => {
    useChatOptions.getState().load();
    useFreshChat.setState((s) => ({ count: s.count + 1 }));
    router.push("/");
  }, [router]);
}

export function useNewChatClick(onDone?: () => void) {
  const startChat = useStartChat();
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    startChat();
    onDone?.();
  };
}
