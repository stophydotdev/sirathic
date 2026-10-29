"use client";

import { useChatState } from "@/components/chat";
import { useT } from "@/components/i18n";
import { useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { type FC, type ReactNode, useState } from "react";

export const ShareMenu: FC<{ className: string; children: (copied: boolean) => ReactNode }> = ({
  className,
  children,
}) => {
  const chat = useChatState();
  const t = useT();
  const [copied, setCopied] = useState(false);
  const published = useSessions(
    (s) => s.sessions?.find((session) => session.id === chat?.id)?.published === true,
  );

  const copy = (path: string) =>
    navigator.clipboard.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });

  const publish = async (next: boolean) => {
    if (!chat?.saved) return;
    const done = await api.sessions.publish
      .mutate({ id: chat.id, published: next })
      .catch(() => undefined);
    if (!done) return;
    useSessions.setState((state) => ({
      sessions: state.sessions?.map((session) =>
        session.id === chat.id ? Object.assign({}, session, done) : session,
      ),
    }));
    if (done.published) await copy(`/p/${chat.id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={!chat?.saved} aria-label={t("Share")} className={className}>
        {children(copied)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem
          onSelect={() => void copy(`/c/${chat?.id ?? ""}`)}
          className="flex-col items-start gap-0"
        >
          <span>{t("Copy link")}</span>
          <span className="text-muted-foreground text-xs">{t("Only you can open it")}</span>
        </DropdownMenuItem>
        {published ? (
          <>
            <DropdownMenuItem onSelect={() => void copy(`/p/${chat?.id ?? ""}`)}>
              {t("Copy page link")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void publish(false)}>
              {t("Unpublish page")}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onSelect={() => void publish(true)}
            className="flex-col items-start gap-0"
          >
            <span>{t("Publish page")}</span>
            <span className="text-muted-foreground text-xs">
              {t("Anyone with the link can read it")}
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
