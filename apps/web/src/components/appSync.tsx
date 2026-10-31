"use client";

import { useAccount } from "@/components/account";
import { useGroups } from "@/components/groups";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { api } from "@/lib/trpc";
import { deviceOf, rememberLanding } from "@/lib/visit";
import { useEffect } from "react";

export const AppSync = () => {
  useEffect(() => {
    rememberLanding();
    const load = () => {
      void useAccount
        .getState()
        .refresh()
        .then(() => {
          if (!useAccount.getState().status?.signedIn) return;
          void api.events.opened.mutate({ device: deviceOf() }).catch(() => undefined);
        });
      void useSessions.getState().refresh();
      void useProjects.getState().refresh();
      void useGroups.getState().refresh();
    };
    void Promise.all([
      useAccount.persist.rehydrate(),
      useSessions.persist.rehydrate(),
      useProjects.persist.rehydrate(),
    ]);
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  return null;
};
