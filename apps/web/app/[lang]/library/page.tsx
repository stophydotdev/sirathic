"use client";

import { useT } from "@/components/i18n";
import { SessionRow } from "@/components/session-menu";
import { findSessions, type Session, useSessions } from "@/components/sessions";
import { ThreadShell } from "@/components/thread-shell";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

const SEARCH_DELAY_MS = 150;

export default function Library() {
  const [query, setQuery] = useState("");
  const t = useT();
  const [found, setFound] = useState<Session[]>();
  const sessions = useSessions((s) => s.sessions);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(
      () =>
        void findSessions(query.trim(), true).then((list) => {
          if (current) setFound(list);
        }),
      SEARCH_DELAY_MS,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, sessions]);

  return (
    <main className="h-dvh">
      <ThreadShell>
        <div className="mx-auto flex h-full w-full max-w-[720px] flex-col px-6 pt-10">
          <h1 className="mb-6 text-2xl tracking-[-0.02em]">{t("Library")}</h1>
          <label className="bg-card mb-4 flex h-11 items-center gap-2 rounded-xl px-3">
            <SearchIcon className="text-muted-foreground size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search chats…")}
              className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-col gap-0.5 overflow-y-auto pb-10">
            {found?.length === 0 && (
              <p className="text-muted-foreground px-2.5 py-2 text-sm">
                {t("No chats found")}
              </p>
            )}
            {found?.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                trailing={
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      </ThreadShell>
    </main>
  );
}
