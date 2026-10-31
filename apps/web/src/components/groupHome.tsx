"use client";

import { BotAvatar } from "@/components/botAvatar";
import { useChatState } from "@/components/chat";
import { Composer } from "@/components/composer";
import { type Group, useGroups } from "@/components/groups";
import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { cn } from "@/lib/utils";
import { type FC, useEffect } from "react";

export const useGroup = () => {
  const projectId = useChatState()?.projectId;
  return useGroups((s) => s.groups?.find((group) => group.id === projectId));
};

export const MemberStack: FC<{ group: Group; className?: string }> = ({ group, className }) => {
  const bots = useProjects((s) => s.bots);
  const members = (group.members ?? []).flatMap((id) => bots?.find((bot) => bot.id === id) ?? []);
  return (
    <span className={cn("flex shrink-0 -space-x-2", className)}>
      {members.slice(0, 3).map((bot) => (
        <BotAvatar
          key={bot.id}
          color={bot.color}
          body={bot.symbol}
          seed={bot.id}
          className="ring-background size-6 rounded-full ring-2"
        />
      ))}
    </span>
  );
};

export const GroupTitle: FC<{ group: Group }> = ({ group }) => (
  <div className="bg-muted flex h-8 min-w-0 items-center gap-2 rounded-xl px-2.5 text-sm font-medium">
    <MemberStack group={group} />
    <span className="max-w-40 truncate">{group.name}</span>
  </div>
);

export const GroupHome: FC<{ group: Group }> = ({ group }) => {
  const t = useT();
  useEffect(() => {
    const previous = document.title;
    document.title = `${group.name} - Sirathic`;
    return () => {
      document.title = previous;
    };
  }, [group.name]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center ps-14 pe-4 lg:ps-4">
        <GroupTitle group={group} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-6">
        <div className="bg-background sticky bottom-0 mx-auto w-full max-w-182 pt-4 pb-3">
          <Composer
            placeholder={t("Message {name}", { name: group.name })}
            menuSide="top"
            bot
            compact
          />
        </div>
      </div>
    </div>
  );
};
