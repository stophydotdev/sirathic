import { refreshing } from "@/lib/refreshing";
import { api } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { create } from "zustand";

export type Plugin = Awaited<ReturnType<typeof api.connectors.list.query>>[number];
export type Skill = Awaited<ReturnType<typeof api.skills.list.query>>[number];

const signedOut = (err: Error) =>
  err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED";

export const useOwnLists = create<{
  plugins: Plugin[];
  skills: Skill[];
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;
}>()((set) => {
  const lists = refreshing(
    () =>
      Promise.all([api.connectors.list.query(), api.skills.list.query()]).then(
        ([plugins, skills]) => ({ plugins, skills }),
        (err: Error) => (signedOut(err) ? { plugins: [], skills: [] } : undefined),
      ),
    (found) => set({ ...found, loaded: true }),
  );
  return {
    plugins: [],
    skills: [],
    loaded: false,
    load: lists.join,
    reload: lists.fresh,
    reset: () => {
      set({ plugins: [], skills: [], loaded: false });
      void lists.fresh();
    },
  };
});
