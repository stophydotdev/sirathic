import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";
import { api } from "./api";
import { useChatState } from "./chat-state";

export type Bot = Awaited<ReturnType<typeof api.projects.list.query>>[number];

type Change = Omit<Parameters<typeof api.projects.update.mutate>[0], "id">;

type BotInput = Parameters<typeof api.projects.create.mutate>[0];

const listed = () =>
  api.projects.list
    .query()
    .catch((err: Error) =>
      err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
    );

export const useBots = create<{
  bots: Bot[] | undefined;
  refresh: () => Promise<void>;
  createBot: (input: BotInput) => Promise<Bot | undefined>;
  change: (id: string, change: Change) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>()((set, get) => ({
  bots: undefined,
  refresh: async () => {
    const bots = await listed();
    if (bots) set({ bots });
  },
  createBot: async (input) => {
    const created = await api.projects.create.mutate(input).catch(() => undefined);
    await get().refresh();
    return created;
  },
  change: async (id, change) => {
    set({ bots: get().bots?.map((bot) => (bot.id === id ? Object.assign({}, bot, change) : bot)) });
    await api.projects.update.mutate(Object.assign({ id }, change)).catch(() => undefined);
    await get().refresh();
  },
  remove: async (id) => {
    set({ bots: get().bots?.filter((bot) => bot.id !== id) });
    await api.projects.remove.mutate({ id }).catch(() => undefined);
    await Promise.all([get().refresh(), useChatState.getState().loadSessions()]);
  },
}));
