"use client";

import { useT } from "@/components/i18n";
import type { LibraryFile } from "@/components/libraryItems";
import { MemoryFacts } from "@/components/memoryFacts";
import { ProjectAutomations } from "@/components/projectAutomations";
import { ProjectFilesSection, ProjectFilesTab, useProjectFiles } from "@/components/projectFiles";
import { pill, ProjectActions, TextDialog } from "@/components/projectMenu";
import { memoryHint, type Project, useProjects } from "@/components/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowExpand01Icon,
  ArrowShrink02Icon,
  File01Icon,
  SidebarRight01Icon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { type FC, useState } from "react";

const iconButton =
  "text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors";

export const ProjectPanel: FC<{
  project: Project;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}> = ({ project, expanded, onExpand, onCollapse }) => {
  const change = useProjects((s) => s.change);
  const [tab, setTab] = useState<"settings" | "files">("settings");
  const [selectedId, setSelectedId] = useState<string>();
  const [editingInstructions, setEditingInstructions] = useState(false);
  const projectFiles = useProjectFiles(project.id);
  const t = useT();
  const id = project.id;
  const selected =
    projectFiles.files.find((file) => file.id === selectedId) ?? projectFiles.files[0];
  const open = (file: LibraryFile) => {
    setSelectedId(file.id);
    setTab("files");
  };
  const expandLabel = expanded ? t("Shrink project panel") : t("Expand project panel");
  const ExpandIcon = expanded ? ArrowShrink02Icon : ArrowExpand01Icon;

  return (
    <div className="border-foreground/10 bg-background flex flex-col rounded-[14px] border shadow-sm lg:h-full lg:overflow-hidden">
      <div className="border-foreground/10 flex items-center gap-1 border-b p-2">
        <div role="tablist" className="flex items-center gap-1">
          {(
            [
              ["settings", t("Settings"), SlidersHorizontalIcon],
              ["files", t("Files"), File01Icon],
            ] as const
          ).map(([name, label, Icon]) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-label={label}
              title={label}
              onClick={() => setTab(name)}
              className={cn(iconButton, tab === name && "bg-muted text-foreground")}
            >
              <HugeiconsIcon icon={Icon} className="size-4.5" />
            </button>
          ))}
        </div>
        <div className="ms-auto hidden items-center gap-1 lg:flex">
          <button
            type="button"
            onClick={onExpand}
            aria-label={expandLabel}
            title={expandLabel}
            aria-pressed={expanded}
            className={iconButton}
          >
            <HugeiconsIcon icon={ExpandIcon} className="size-4.5" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t("Hide project settings")}
            title={t("Hide project settings")}
            className={iconButton}
          >
            <HugeiconsIcon icon={SidebarRight01Icon} className="size-5" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 lg:flex-1",
          tab === "files" ? "h-[60dvh] lg:h-auto" : "px-4 lg:overflow-y-auto",
        )}
      >
        {tab === "files" ? (
          <ProjectFilesTab files={projectFiles.files} selected={selected} onSelect={open} />
        ) : (
          <div className="divide-foreground/10 flex flex-col divide-y">
            <div className="flex items-center gap-2 py-3">
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-[550]">
                {t("{name}'s settings", { name: project.name })}
              </h2>
              <ProjectActions
                project={project}
                align="end"
                triggerClassName="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full"
              />
            </div>
            <div className="flex items-center gap-3 py-4">
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="text-sm font-medium">{t("Instructions")}</h3>
                <p className="text-muted-foreground truncate text-[13px]">
                  {project.instructions || t("Add instructions to customize Noor's responses")}
                </p>
              </div>
              <button type="button" onClick={() => setEditingInstructions(true)} className={pill}>
                {project.instructions ? t("View") : t("Add")}
              </button>
            </div>
            <div className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="text-sm font-medium">{t("Memory")}</h3>
                  <p className="text-muted-foreground truncate text-[13px]">
                    {t(memoryHint(project.projectOnlyMemory))}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger className={pill}>
                    {project.projectOnlyMemory ? t("Project only") : t("Default")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuRadioGroup
                      value={project.projectOnlyMemory ? "project" : "default"}
                      onValueChange={(value) =>
                        void change(id, { projectOnlyMemory: value === "project" })
                      }
                    >
                      <DropdownMenuRadioItem value="default">{t("Default")}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="project">
                        {t("Project only")}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {project.projectOnlyMemory && (
                <div className="mt-3">
                  <MemoryFacts
                    memory={project.memory}
                    onChange={(memory) => void change(id, { memory: [...memory] })}
                  />
                </div>
              )}
            </div>
            <ProjectAutomations projectId={id} />
            <ProjectFilesSection project={projectFiles} onOpen={open} />
          </div>
        )}
      </div>
      {editingInstructions && (
        <TextDialog
          title={t("Set project instructions")}
          description={t("Provide Noor with instructions for chats in this project.")}
          placeholder={t("Add instructions for Noor in this project…")}
          value={project.instructions}
          maxLength={4000}
          multiline
          onSave={(instructions) => void change(id, { instructions })}
          onClose={() => setEditingInstructions(false)}
        />
      )}
    </div>
  );
};
