import { useSessions } from "@/components/sessions";
import type { Translate } from "@/components/i18n";
import { api } from "@/lib/trpc";
import { containsLink } from "@sirathic/server/projects";
import { create } from "zustand";

export type Project = Awaited<ReturnType<typeof api.projects.list.query>>[number];

type Change = Omit<Parameters<typeof api.projects.update.mutate>[0], "id">;

export const useProjects = create<{
  projects: Project[] | undefined;
  refresh: () => Promise<void>;
  create: (name: string, projectOnlyMemory: boolean) => Promise<Project | undefined>;
  change: (id: string, change: Change) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>()((set, get) => ({
  projects: undefined,
  refresh: async () => {
    set({ projects: await api.projects.list.query().catch(() => get().projects) });
  },
  create: async (name, projectOnlyMemory) => {
    const created = await api.projects.create
      .mutate({ name, projectOnlyMemory })
      .catch(() => undefined);
    await get().refresh();
    return created;
  },
  change: async (id, change) => {
    set({
      projects: get().projects?.map((project) =>
        project.id === id ? Object.assign({}, project, change) : project,
      ),
    });
    await api.projects.update.mutate(Object.assign({ id }, change)).catch(() => undefined);
    await get().refresh();
  },
  remove: async (id) => {
    set({ projects: get().projects?.filter((project) => project.id !== id) });
    await api.projects.remove.mutate({ id }).catch(() => undefined);
    await Promise.all([get().refresh(), useSessions.getState().refresh()]);
  },
}));

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
