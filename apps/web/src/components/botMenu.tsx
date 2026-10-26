"use client";

import { sectionNames } from "@/components/botGroups";
import { BotSettings } from "@/components/botSettings";
import { useT } from "@/components/i18n";
import { DeleteProjectDialog, TextDialog } from "@/components/projectMenu";
import { type Project, useProjects } from "@/components/projects";
import { menuIcon, menuItem } from "@/components/sessionMenu";
import { useSessions } from "@/components/sessions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { SECTION_NAME_MAX } from "@sirathic/server/projects";
import {
  IconCheck,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFolderPlus,
  IconFolderSymlink,
  IconMail,
  IconMailOpened,
  IconPin,
  IconPinnedOff,
  IconTrash,
  IconUserEdit,
} from "@tabler/icons-react";
import type { FC } from "react";
import { useState } from "react";

export const BotMenu: FC<{
  bot: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className: string;
}> = ({ bot, open, onOpenChange, className }) => {
  const bots = useProjects((s) => s.bots) ?? [];
  const change = useProjects((s) => s.change);
  const session = useSessions((s) => s.sessions?.find((found) => found.id === bot.id));
  const changeSession = useSessions((s) => s.change);
  const [editing, setEditing] = useState<"profile" | "section" | "delete">();
  const t = useT();
  const close = () => setEditing(undefined);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          aria-label={t("More actions")}
          className={className}
          onClick={(event) => event.stopPropagation()}
        >
          <IconDots className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 rounded-[16px] p-1.5">
          <DropdownMenuItem
            onSelect={() => void change(bot.id, { pinned: !bot.pinned })}
            className={menuItem}
          >
            {bot.pinned ? <IconPinnedOff className={menuIcon} /> : <IconPin className={menuIcon} />}
            {bot.pinned ? t("Unpin") : t("Pin")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={menuItem}>
              <IconFolderSymlink className={menuIcon} />
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
                  {bot.section === section && <IconCheck className="ms-auto size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onSelect={() => void change(bot.id, { section: null })}
                className={menuItem}
              >
                {t("No section")}
                {!bot.section && <IconCheck className="ms-auto size-4" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setEditing("section")} className={menuItem}>
            <IconFolderPlus className={menuIcon} />
            {t("Move to new section")}
          </DropdownMenuItem>
          {session && (
            <DropdownMenuItem
              onSelect={() => void changeSession(session.id, { unread: !session.unread })}
              className={menuItem}
            >
              {session.unread ? (
                <IconMailOpened className={menuIcon} />
              ) : (
                <IconMail className={menuIcon} />
              )}
              {session.unread ? t("Mark as read") : t("Mark as unread")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setEditing("profile")} className={menuItem}>
            <IconUserEdit className={menuIcon} />
            {t("Edit profile")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void change(bot.id, { hidden: !bot.hidden })}
            className={menuItem}
          >
            {bot.hidden ? <IconEye className={menuIcon} /> : <IconEyeOff className={menuIcon} />}
            {bot.hidden ? t("Unhide") : t("Hide from sidebar")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setEditing("delete")}
            className={menuItem}
          >
            <IconTrash className="size-[18px]" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing === "profile" && <BotSettings bot={bot} onClose={close} />}
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
      {editing === "delete" && (
        <DeleteProjectDialog id={bot.id} name={bot.name} bot onClose={close} />
      )}
    </>
  );
};
