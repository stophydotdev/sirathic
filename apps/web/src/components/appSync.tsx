"use client";

import { useAccount } from "@/components/account";
import { useProjects } from "@/components/projects";
import { useSessions } from "@/components/sessions";
import { useEffect } from "react";

export const AppSync = () => {
  useEffect(() => {
    const load = () => {
      void useAccount.getState().refresh();
      void useSessions.getState().refresh();
      void useProjects.getState().refresh();
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
