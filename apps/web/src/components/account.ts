import { useOwnLists } from "@/components/ownLists";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { api } from "@/lib/trpc";
import type { MessageKey } from "@/messages/en";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Status = Awaited<ReturnType<typeof api.account.status.query>>;

export const ACCOUNT_LABELS = {
  google: { account: "Google account", signedIn: "Signed in with Google" },
  github: { account: "GitHub account", signedIn: "Signed in with GitHub" },
  chatgpt: { account: "ChatGPT account", signedIn: "Signed in with ChatGPT" },
} as const satisfies Record<
  Extract<Status, { signedIn: true }>["via"],
  { account: MessageKey; signedIn: MessageKey }
>;
export type Model = Awaited<ReturnType<typeof api.account.models.query>>[number];
export type Plan = Awaited<ReturnType<typeof api.plans.list.query>>[number];

type Models = { list: Model[]; error?: string };

const loadModels = (): Promise<Models> =>
  api.account.models.query().then(
    (list) => ({ list }),
    (err: Error) => ({ list: [], error: err.message }),
  );

export const useAccount = create<{
  status: Status | undefined;
  models: Model[];
  modelsError: string | undefined;
  plans: Plan[];
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
      plans: [],
      chosen: undefined,
      refresh: async () => {
        void fetch("/api/auth/get-session").catch(() => undefined);
        const [status, models, plans] = await Promise.all([
          api.account.status.query().catch(() => undefined),
          loadModels(),
          api.plans.list.query().catch(() => []),
        ]);
        if (!status) return;
        const before = get().status;
        const sameUser =
          before?.signedIn === status.signedIn &&
          (!status.signedIn || (before.signedIn && before.label === status.label));
        if (before && !sameUser) useOwnLists.getState().reset();
        set({ status, models: models.list, modelsError: models.error, plans });
      },
      choose: (slug) => set({ chosen: slug }),
      signOut: async () => {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
        useOwnLists.getState().reset();
        await Promise.all([
          get().refresh(),
          useSessions.getState().refresh(),
          useProjects.getState().refresh(),
        ]);
      },
    }),
    {
      name: "sirathicAccount",
      partialize: ({ status, models, plans, chosen }) => ({ status, models, plans, chosen }),
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
