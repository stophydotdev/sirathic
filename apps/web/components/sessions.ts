import { api } from "@/lib/trpc";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Session = Awaited<
  ReturnType<typeof api.sessions.list.query>
>[number];

type Change = Omit<Parameters<typeof api.sessions.update.mutate>[0], "id">;

export const findSessions = (query: string, all = false) =>
  api.sessions.list.query({ query, all }).catch(() => []);

export const useSessions = create<{
  sessions: Session[] | undefined;
  refresh: () => Promise<void>;
  change: (id: string, change: Change) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>()(
  persist(
    (set, get) => ({
      sessions: undefined,
      refresh: async () => {
        set({ sessions: await findSessions("") });
      },
      change: async (id, change) => {
        set({
          sessions: get().sessions?.map((session) =>
            session.id === id ? Object.assign({}, session, change) : session,
          ),
        });
        await api.sessions.update
          .mutate(Object.assign({ id }, change))
          .catch(() => undefined);
        await get().refresh();
      },
      remove: async (id) => {
        set({
          sessions: get().sessions?.filter((session) => session.id !== id),
        });
        await api.sessions.remove.mutate({ id }).catch(() => undefined);
        await get().refresh();
      },
    }),
    {
      name: "sirathicSessions",
      partialize: ({ sessions }) => ({ sessions }),
      skipHydration: true,
    },
  ),
);
