import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { api } from "@/lib/trpc";
import type { PlainKey } from "@/components/locales";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Status = Awaited<ReturnType<typeof api.account.status.query>>;
export type Model = Awaited<ReturnType<typeof api.account.models.query>>[number];

type Models = { list: Model[]; error?: string };

export const MODEL_DESCRIPTIONS = new Map<string, PlainKey>([
  ["sirathic-noor-1-flash", "Longer answers that explain more"],
]);

const loadModels = (): Promise<Models> =>
  api.account.models.query().then(
    (list) => ({ list }),
    (err: Error) => ({ list: [], error: err.message }),
  );

export const useAccount = create<{
  status: Status | undefined;
  models: Model[];
  modelsError: string | undefined;
  chosen: string | undefined;
  refresh: () => Promise<void>;
  choose: (slug: string) => void;
  signOut: () => Promise<void>;
}>()(
  persist(
    (set, get) => ({
      status: undefined,
      models: [],
      modelsError: undefined,
      chosen: undefined,
      refresh: async () => {
        void fetch("/api/auth/get-session").catch(() => undefined);
        const [status, models] = await Promise.all([
          api.account.status.query().catch(() => undefined),
          loadModels(),
        ]);
        if (status) set({ status, models: models.list, modelsError: models.error });
      },
      choose: (slug) => set({ chosen: slug }),
      signOut: async () => {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
        await Promise.all([
          get().refresh(),
          useSessions.getState().refresh(),
          useProjects.getState().refresh(),
        ]);
      },
    }),
    {
      name: "sirathicAccount",
      partialize: ({ status, models, chosen }) => ({ status, models, chosen }),
      skipHydration: true,
    },
  ),
);

export const useCurrentModel = () =>
  useAccount((s) => s.models.find((model) => model.slug === s.chosen) ?? s.models[0]);

export function chosenModel() {
  const { chosen, models } = useAccount.getState();
  return models.some((model) => model.slug === chosen) ? chosen : undefined;
}
