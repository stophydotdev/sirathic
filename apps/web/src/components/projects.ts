import { useSessions } from "@/components/sessions";
import type { Translate } from "@/components/i18n";
import { refreshing } from "@/lib/refreshing";
import { api } from "@/lib/trpc";
import { containsLink } from "@sirathic/server/projects";
import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Project = Awaited<ReturnType<typeof api.projects.list.query>>[number];

type Change = Omit<Parameters<typeof api.projects.update.mutate>[0], "id">;

type BotInput = Parameters<typeof api.projects.create.mutate>[0];

export const useProjects = create<{
  bots: Project[] | undefined;
  refresh: () => Promise<void>;
  createBot: (input: BotInput) => Promise<Project | undefined>;
  change: (id: string, change: Change) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>()(
  persist(
    (set, get) => ({
      bots: undefined,
      refresh: () => list.join(),
      createBot: async (input) => {
        const created = await api.projects.create.mutate(input).catch(() => undefined);
        await list.fresh();
        return created;
      },
      change: async (id, change) => {
        set({
          bots: get().bots?.map((bot) => (bot.id === id ? Object.assign({}, bot, change) : bot)),
        });
        await api.projects.update.mutate(Object.assign({ id }, change)).catch(() => undefined);
        await list.fresh();
      },
      remove: async (id) => {
        set({ bots: get().bots?.filter((bot) => bot.id !== id) });
        await api.projects.remove.mutate({ id }).catch(() => undefined);
        await Promise.all([list.fresh(), useSessions.getState().refresh()]);
      },
    }),
    {
      name: "sirathicProjects",
      partialize: ({ bots }) => ({ bots }),
      skipHydration: true,
    },
  ),
);

const list = refreshing(
  () =>
    api.projects.list
      .query()
      .catch((err: Error) =>
        err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
      ),
  (bots): void => {
    useProjects.setState({ bots });
  },
);

export const projectNameError = (t: Translate, name: string) =>
  containsLink(name) ? t("A project name cannot contain a link.") : undefined;
