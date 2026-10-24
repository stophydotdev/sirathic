import type { MessageKey } from "@/messages/en";
import { z } from "zod";
import { create } from "zustand";
import { usePreferences } from "@/components/preferences";
import { type Mode, mode as modeSchema } from "@sirathic/server/messages";

const STORAGE_KEY = "sirathicChatOptions";

const saved = z.object({
  mode: modeSchema.catch("quick"),
});

type Override = { mode?: Mode; model?: string };

const read = () => {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  const parsed = saved.safeParse(raw ? JSON.parse(raw) : {});
  return parsed.success ? parsed.data : { mode: "quick" as const };
};

export const MODE_DETAILS = {
  quick: {
    name: "Quick",
    description: "Searches everything first, then answers fast",
  },
  research: {
    name: "Research",
    description: "Thinks longer and searches step by step",
  },
} satisfies Record<Mode, { name: MessageKey; description: MessageKey }>;

export const useChatOptions = create<{
  mode: Mode;
  incognito: boolean;
  override: Override | undefined;
  loaded: boolean;
  load: () => void;
  setMode: (next: Mode) => void;
  setIncognito: (on: boolean) => void;
  setOverride: (next: Override) => void;
  takeOverride: () => Override | undefined;
}>()((set, get) => {
  const persist = () => {
    const { mode } = get();
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ mode }));
  };
  return {
    mode: "quick",
    incognito: false,
    override: undefined,
    loaded: false,
    load: () =>
      set({
        ...read(),
        incognito:
          new URLSearchParams(globalThis.location?.search).has("incognito") ||
          usePreferences.getState().incognitoByDefault,
        loaded: true,
      }),
    setMode: (next) => {
      set({ mode: next });
      persist();
    },
    setIncognito: (on) => set({ incognito: on }),
    setOverride: (next) => set({ override: next }),
    takeOverride: () => {
      const { override } = get();
      set({ override: undefined });
      return override;
    },
  };
});
