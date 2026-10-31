import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";
import { api } from "./api";
import { useChatState } from "./chat-state";

export type Group = Awaited<ReturnType<typeof api.groups.list.query>>[number];

type GroupInput = Parameters<typeof api.groups.create.mutate>[0];

const listed = () =>
  api.groups.list
    .query()
    .catch((err: Error) =>
      err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
    );

export const useGroups = create<{
  groups: Group[] | undefined;
  refresh: () => Promise<void>;
  createGroup: (input: GroupInput) => Promise<Group | undefined>;
  remove: (id: string) => Promise<void>;
}>()((set, get) => ({
  groups: undefined,
  refresh: async () => {
    const groups = await listed();
    if (groups) set({ groups });
  },
  createGroup: async (input) => {
    const created = await api.groups.create.mutate(input).catch(() => undefined);
    await get().refresh();
    return created;
  },
  remove: async (id) => {
    set({ groups: get().groups?.filter((group) => group.id !== id) });
    await api.projects.remove.mutate({ id }).catch(() => undefined);
    await Promise.all([get().refresh(), useChatState.getState().loadSessions()]);
  },
}));
