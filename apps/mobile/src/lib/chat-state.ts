import type { Mode } from "@sirathic/server/messages";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { api } from "./api";

export type Model = Awaited<
  ReturnType<typeof api.account.models.query>
>[number];

export const useChatState = create<{
  chatId: string;
  mode: Mode;
  models: Model[];
  model: string | undefined;
  newChat: () => void;
  setMode: (mode: Mode) => void;
  choose: (slug: string) => void;
  loadModels: () => Promise<void>;
}>()((set) => ({
  chatId: randomUUID(),
  mode: "quick",
  models: [],
  model: undefined,
  newChat: () => set({ chatId: randomUUID() }),
  setMode: (mode) => set({ mode }),
  choose: (model) => set({ model }),
  loadModels: async () => {
    const models = await api.account.models.query().catch(() => []);
    set((state) => ({
      models,
      model: models.some((m) => m.slug === state.model)
        ? state.model
        : models[0]?.slug,
    }));
  },
}));
