"use client";

import { type Group, useGroups } from "@/components/groups";
import { MemberStack } from "@/components/groupHome";
import { useT } from "@/components/i18n";
import { useSessions } from "@/components/sessions";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC } from "react";

const GroupRow: FC<{ group: Group; onDone?: () => void }> = ({ group, onDone }) => {
  const pathname = usePathname();
  const session = useSessions((s) => s.sessions?.find((found) => found.id === group.id));
  const t = useT();
  const href = `/group/${group.id}`;
  return (
    <div
      data-row
      data-active={pathname === href || undefined}
      className="group/bot hover:bg-muted relative flex items-center rounded-xl transition-colors"
    >
      <Link
        href={href}
        onClick={onDone}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2"
      >
        <MemberStack group={group} className="w-11" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn("text-foreground truncate text-sm", session?.unread && "font-medium")}
          >
            {group.name}
          </span>
          <span className="text-muted-foreground truncate text-xs">{session?.preview ?? ""}</span>
        </span>
        {session?.unread && <span className="bg-super size-1.5 shrink-0 rounded-full" />}
      </Link>
      <button
        type="button"
        aria-label={t("Delete group")}
        title={t("Delete group")}
        onClick={() => {
          if (
            window.confirm(
              t('Delete the group "{name}"? Its conversation is deleted too.', {
                name: group.name,
              }),
            )
          ) {
            void useGroups.getState().remove(group.id);
          }
        }}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute end-2 top-2 hidden size-5 items-center justify-center rounded-md group-focus-within/bot:flex group-hover/bot:flex pointer-coarse:flex"
      >
        <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
      </button>
    </div>
  );
};

export const GroupList: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const groups = useGroups((s) => s.groups) ?? [];
  const t = useT();
  if (groups.length === 0) return null;
  return (
    <>
      <p className="text-muted-foreground ps-2.5 pt-6 pb-1 text-sm">{t("Groups")}</p>
      <div className="flex flex-col gap-0.5">
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} onDone={onDone} />
        ))}
      </div>
    </>
  );
};
