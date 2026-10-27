"use client";

import { Chat } from "@/components/chat";
import { useChatOptions } from "@/components/chatOptions";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
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
