"use client";

import { useT } from "@/components/i18n";
import { useProjects } from "@/components/projects";
import { type Session, useSessions } from "@/components/sessions";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdownMenu";
import { IconCheck, IconFolderMinus, IconFolderSymlink } from "@tabler/icons-react";
import type { FC } from "react";

const menuItem = "min-h-8 gap-2 rounded-[10px] px-2";
const menuIcon = "text-muted-foreground size-[18px]";

export const MoveToProject: FC<{ session: Session }> = ({ session }) => {
  const projects = useProjects((s) => s.projects);
  const change = useSessions((s) => s.change);
  const t = useT();

  if (!projects) return null;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={menuItem}>
        <IconFolderSymlink className={menuIcon} />
        {t("Move to project")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-72 w-56 overflow-y-auto rounded-[16px] p-1.5">
        {projects.length === 0 && (
          <p className="text-muted-foreground px-2 py-1.5 text-sm">{t("No projects yet")}</p>
        )}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() => void change(session.id, { projectId: project.id })}
            className={menuItem}
          >
            <span className="truncate">{project.name}</span>
            {session.projectId === project.id && <IconCheck className="ms-auto size-4" />}
          </DropdownMenuItem>
        ))}
        {session.projectId && (
          <DropdownMenuItem
            onSelect={() => void change(session.id, { projectId: null })}
            className={menuItem}
          >
            <IconFolderMinus className={menuIcon} />
            {t("Remove from project")}
          </DropdownMenuItem>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
