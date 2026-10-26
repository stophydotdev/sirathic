import { useSessions } from "@/components/sessions";
import type { Translate } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { containsLink } from "@sirathic/server/projects";
import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Project = Awaited<ReturnType<typeof api.projects.list.query>>[number];

type Change = Omit<Parameters<typeof api.projects.update.mutate>[0], "id">;

type BotInput = Omit<Parameters<typeof api.projects.create.mutate>[0], "kind">;

const byKind = (all: Project[]) => ({
  projects: all.filter((project) => project.kind === "project"),
  bots: all.filter((project) => project.kind === "bot"),
});

const changed = (list: Project[] | undefined, id: string, change: Change) =>
  list?.map((project) => (project.id === id ? Object.assign({}, project, change) : project));

export const useProjects = create<{
  projects: Project[] | undefined;
  bots: Project[] | undefined;
  refresh: () => Promise<void>;
  create: (name: string, projectOnlyMemory: boolean) => Promise<Project | undefined>;
  createBot: (input: BotInput) => Promise<Project | undefined>;
  change: (id: string, change: Change) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>()(
  persist(
    (set, get) => ({
      projects: undefined,
      bots: undefined,
      refresh: async () => {
        const all = await api.projects.list
          .query()
          .catch((err: Error) =>
            err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
          );
        if (all) set(byKind(all));
      },
      create: async (name, projectOnlyMemory) => {
        const created = await api.projects.create
          .mutate({ name, projectOnlyMemory })
          .catch(() => undefined);
        await get().refresh();
        return created;
      },
      createBot: async (input) => {
        const created = await api.projects.create
          .mutate({ ...input, kind: "bot" })
          .catch(() => undefined);
        await get().refresh();
        return created;
      },
      change: async (id, change) => {
        set({
          projects: changed(get().projects, id, change),
          bots: changed(get().bots, id, change),
        });
        await api.projects.update.mutate(Object.assign({ id }, change)).catch(() => undefined);
        await get().refresh();
      },
      remove: async (id) => {
        set({
          projects: get().projects?.filter((project) => project.id !== id),
          bots: get().bots?.filter((bot) => bot.id !== id),
        });
        await api.projects.remove.mutate({ id }).catch(() => undefined);
        await Promise.all([get().refresh(), useSessions.getState().refresh()]);
      },
    }),
    {
      name: "sirathicProjects",
      partialize: ({ projects, bots }) => ({ projects, bots }),
      skipHydration: true,
    },
  ),
);

export const MEMORY_OPTIONS = [
  { projectOnly: false, label: "Default", hint: "Chats here use and add to your main memory." },
  {
    projectOnly: true,
    label: "Project only",
    hint: "Chats here only see what Noor remembers in this project.",
  },
] as const;

export const memoryHint = (projectOnly: boolean) => MEMORY_OPTIONS[projectOnly ? 1 : 0].hint;

export const projectNameError = (t: Translate, name: string) =>
  containsLink(name) ? t("A project name cannot contain a link.") : undefined;
