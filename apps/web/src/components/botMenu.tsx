"use client";

import { sectionNames } from "@sirathic/app/botGroups";
import { useBotPanel } from "@/components/botSettings";
import { useT } from "@/components/i18n";
import { DeleteProjectDialog, TextDialog } from "@/components/projectMenu";
import { type Project, useProjects } from "@/components/projects";
import { menuIcon, menuItem } from "@/components/sessionMenu";
import { useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { SECTION_NAME_MAX } from "@sirathic/server/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  FolderAddIcon,
  FolderShared01Icon,
  Mail01Icon,
  MailOpen01Icon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
  Tick02Icon,
  UserEdit01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { usePathname, useRouter } from "next/navigation";
import type { FC } from "react";
import { useState } from "react";

export const BotMenu: FC<{
  bot: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
  onDone?: () => void;
}> = ({ bot, open, onOpenChange, className, onDone }) => {
  const bots = useProjects((s) => s.bots) ?? [];
  const change = useProjects((s) => s.change);
  const session = useSessions((s) => s.sessions?.find((found) => found.id === bot.id));
  const changeSession = useSessions((s) => s.change);
  const [editing, setEditing] = useState<"section" | "delete">();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const close = () => setEditing(undefined);
  const editProfile = () => {
    onDone?.();
    if (pathname !== `/bot/${bot.id}`) router.push(`/bot/${bot.id}`);
    useBotPanel.getState().show("settings");
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          aria-label={t("More actions")}
          className={className}
          onClick={(event) => event.stopPropagation()}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-[16px] p-1.5">
          <DropdownMenuItem
            onSelect={() => void change(bot.id, { pinned: !bot.pinned })}
            className={menuItem}
          >
            {bot.pinned ? (
              <HugeiconsIcon icon={PinOffIcon} className={menuIcon} />
            ) : (
              <HugeiconsIcon icon={PinIcon} className={menuIcon} />
            )}
            {bot.pinned ? t("Unpin") : t("Pin")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={menuItem}>
              <HugeiconsIcon icon={FolderShared01Icon} className={menuIcon} />
              {t("Move to")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-56 overflow-y-auto rounded-[16px] p-1.5">
              {sectionNames(bots).map((section) => (
                <DropdownMenuItem
                  key={section}
                  onSelect={() => void change(bot.id, { section })}
                  className={menuItem}
                >
                  <span className="truncate">{section}</span>
                  {bot.section === section && (
                    <HugeiconsIcon icon={Tick02Icon} className="ms-auto size-4" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onSelect={() => void change(bot.id, { section: null })}
                className={menuItem}
              >
                {t("No section")}
                {!bot.section && <HugeiconsIcon icon={Tick02Icon} className="ms-auto size-4" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setEditing("section")} className={menuItem}>
            <HugeiconsIcon icon={FolderAddIcon} className={menuIcon} />
            {t("Move to new section")}
          </DropdownMenuItem>
          {session && (
            <DropdownMenuItem
              onSelect={() => void changeSession(session.id, { unread: !session.unread })}
              className={menuItem}
            >
              {session.unread ? (
                <HugeiconsIcon icon={MailOpen01Icon} className={menuIcon} />
              ) : (
                <HugeiconsIcon icon={Mail01Icon} className={menuIcon} />
              )}
              {session.unread ? t("Mark as read") : t("Mark as unread")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={editProfile} className={menuItem}>
            <HugeiconsIcon icon={UserEdit01Icon} className={menuIcon} />
            {t("Edit profile")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void change(bot.id, { hidden: !bot.hidden })}
            className={menuItem}
          >
            {bot.hidden ? (
              <HugeiconsIcon icon={ViewIcon} className={menuIcon} />
            ) : (
              <HugeiconsIcon icon={ViewOffIcon} className={menuIcon} />
            )}
            {bot.hidden ? t("Unhide") : t("Hide from sidebar")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setEditing("delete")}
            className={menuItem}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-[18px]" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing === "section" && (
        <TextDialog
          title={t("Move to new section")}
          value=""
          maxLength={SECTION_NAME_MAX}
          required
          onSave={(section) => void change(bot.id, { section })}
          onClose={close}
        />
      )}
      {editing === "delete" && <DeleteProjectDialog id={bot.id} name={bot.name} onClose={close} />}
    </>
  );
};
