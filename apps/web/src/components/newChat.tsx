"use client";

import { Chat } from "@/components/chat";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { create } from "zustand";

const useFreshChat = create<{ count: number }>(() => ({ count: 0 }));

export const NewChat = () => <Chat key={useFreshChat((s) => s.count)} />;

export function useStartChat() {
  const router = useRouter();
  return useCallback(() => {
    useFreshChat.setState((s) => ({ count: s.count + 1 }));
    router.push("/");
  }, [router]);
}
