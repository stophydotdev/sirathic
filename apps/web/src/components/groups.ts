import { useSessions } from "@/components/sessions";
import { refreshing } from "@/lib/refreshing";
import { api } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";

export type Group = Awaited<ReturnType<typeof api.groups.list.query>>[number];

type GroupInput = Parameters<typeof api.groups.create.mutate>[0];

export const useGroupTyping = create<Record<string, boolean>>(() => ({}));

export const useGroups = create<{
  groups: Group[] | undefined;
  refresh: () => Promise<void>;
  createGroup: (input: GroupInput) => Promise<Group | undefined>;
  remove: (id: string) => Promise<void>;
}>()((set, get) => ({
  groups: undefined,
  refresh: () => list.join(),
  createGroup: async (input) => {
    const created = await api.groups.create.mutate(input).catch(() => undefined);
    await list.fresh();
    return created;
  },
  remove: async (id) => {
    set({ groups: get().groups?.filter((group) => group.id !== id) });
    await api.projects.remove.mutate({ id }).catch(() => undefined);
    await Promise.all([list.fresh(), useSessions.getState().refresh()]);
  },
}));

const list = refreshing(
  () =>
    api.groups.list
      .query()
      .catch((err: Error) =>
        err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED" ? [] : undefined,
      ),
  (groups): void => {
    useGroups.setState({ groups });
  },
);
