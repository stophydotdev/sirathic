import type { MessageKey } from "@/messages/en";
import { z } from "zod";
import { create } from "zustand";
import { usePreferences } from "@/components/preferences";
import {
  type Effort,
  effort as effortSchema,
  type Mode,
  mode as modeSchema,
} from "@sirathic/server/messages";
import { type SourceKind, sourceKind } from "@sirathic/server/sources";

const STORAGE_KEY = "sirathicChatOptions";

const saved = z.object({
  mode: modeSchema.catch("quick"),
  effort: effortSchema.optional().catch(undefined),
  sources: z.array(sourceKind).min(1).optional().catch(undefined),
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
  defaultMode: Mode;
  effort: Effort | undefined;
  sources: SourceKind[] | undefined;
  incognito: boolean;
  override: Override | undefined;
  loaded: boolean;
  load: () => void;
  setMode: (next: Mode) => void;
  setDefaultMode: (next: Mode) => void;
  setEffort: (next: Effort | undefined) => void;
  setSources: (next: SourceKind[] | undefined) => void;
  setIncognito: (on: boolean) => void;
  setOverride: (next: Override) => void;
  takeOverride: () => Override | undefined;
}>()((set, get) => {
  const persist = () => {
    const { defaultMode, effort, sources } = get();
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode: defaultMode, effort, sources }),
    );
  };
  return {
    mode: "quick",
    defaultMode: "quick",
    effort: undefined,
    sources: undefined,
    incognito: false,
    override: undefined,
    loaded: false,
    load: () => {
      const { mode, effort, sources } = read();
      set({
        mode,
        defaultMode: mode,
        effort,
        sources,
        incognito:
          new URLSearchParams(globalThis.location?.search).has("incognito") ||
          usePreferences.getState().incognitoByDefault,
        loaded: true,
      });
    },
    setMode: (next) => set({ mode: next }),
    setDefaultMode: (next) => {
      set({ mode: next, defaultMode: next });
      persist();
    },
    setEffort: (next) => {
      set({ effort: next });
      persist();
    },
    setSources: (next) => {
      set({ sources: next });
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
