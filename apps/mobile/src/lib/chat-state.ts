import type { Effort, Mode } from "@sirathic/server/messages";
import { TRPCClientError } from "@trpc/client";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { api } from "./api";
import { usePreferences } from "./preferences";

export type Model = Awaited<ReturnType<typeof api.account.models.query>>[number];
export type Session = Awaited<ReturnType<typeof api.sessions.list.query>>[number];
type Account = Awaited<ReturnType<typeof api.account.status.query>>;

export const useChatState = create<{
  chatId: string;
  saved: boolean;
  mode: Mode;
  effort: Effort | undefined;
  incognito: boolean;
  draft: string;
  account: Account | undefined;
  models: Model[];
  model: string | undefined;
  sessions: Session[] | undefined;
  newChat: () => void;
  open: (id: string) => void;
  setMode: (mode: Mode) => void;
  setEffort: (effort: Effort) => void;
  setIncognito: (on: boolean) => void;
  setDraft: (draft: string) => void;
  choose: (slug: string) => void;
  loadAccount: () => Promise<void>;
  loadSessions: () => Promise<void>;
}>()((set) => ({
  chatId: randomUUID(),
  saved: false,
  mode: usePreferences.getState().defaultMode,
  effort: undefined,
  incognito: usePreferences.getState().incognitoByDefault,
  draft: "",
  account: undefined,
  models: [],
  model: undefined,
  sessions: undefined,
  newChat: () => {
    const { defaultMode, incognitoByDefault } = usePreferences.getState();
    set({ chatId: randomUUID(), saved: false, mode: defaultMode, incognito: incognitoByDefault });
  },
  open: (chatId) => set({ chatId, saved: true }),
  setMode: (mode) => set({ mode }),
  setEffort: (effort) => set({ effort }),
  setIncognito: (incognito) => set({ incognito }),
  setDraft: (draft) => set({ draft }),
  choose: (model) => set({ model }),
  loadAccount: async () => {
    const [account, models] = await Promise.all([
      api.account.status.query().catch(() => undefined),
      api.account.models.query().catch(() => []),
    ]);
    set((state) => ({
      account,
      models,
      model: models.some((m) => m.slug === state.model) ? state.model : models[0]?.slug,
    }));
  },
  loadSessions: async () => {
    const sessions = await api.sessions.list
      .query({ query: "" })
      .catch((err: Error) =>
        err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
      );
    if (sessions) set({ sessions });
  },
}));
