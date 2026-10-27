"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { ProjectIcon } from "@/components/projectIcon";
import { NewProjectDialog } from "@/components/projectNav";
import { type Project, useProjects } from "@/components/projects";
import { useSignIn } from "@/components/signIn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, PackageIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, useState } from "react";
import { z } from "zod";

const SORTS = {
  edited: { label: "Last edited", key: "updatedAt" },
  created: { label: "Date created", key: "createdAt" },
} as const;

const sortName = z.enum(["edited", "created"]);

const ProjectCard: FC<{ project: Project }> = ({ project }) => {
  const t = useT();
  return (
    <Link
      href={`/project/${project.id}`}
      className="bg-muted/50 hover:bg-muted flex flex-col gap-1 rounded-xl p-3 transition-colors"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ProjectIcon icon={project.icon} className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate text-sm font-[550]">{project.name}</span>
      </span>
      <span className="text-muted-foreground truncate text-sm">
        {project.instructions || t("Add instructions that apply to every chat in this project")}
      </span>
    </Link>
  );
};

export const ProjectsPage: FC = () => {
  const projects = useProjects((s) => s.projects);
  const signedIn = useAccount((s) => s.status?.signedIn);
  const ask = useSignIn((s) => s.ask);
  const [sort, setSort] = useState<z.infer<typeof sortName>>("edited");
  const [adding, setAdding] = useState(false);
  const t = useT();
  const create = () => (signedIn ? setAdding(true) : ask());
  const sorted = (projects ?? []).toSorted((a, b) => b[SORTS[sort].key] - a[SORTS[sort].key]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-16 lg:pt-10">
        <h1 className="mb-4 text-2xl font-[580]">{t("Projects")}</h1>
        <div className="mb-4 flex items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="bg-muted hover:bg-foreground/10 flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors">
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
              {t(SORTS[sort].label)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(sortName.parse(value))}
              >
                {sortName.options.map((name) => (
                  <DropdownMenuRadioItem key={name} value={name}>
                    {t(SORTS[name].label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={create}
            className="bg-foreground text-background flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition hover:opacity-85"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("Create new")}
          </button>
        </div>
        {projects !== undefined && sorted.length === 0 && (
          <div className="border-foreground/10 mb-4 flex flex-col items-center gap-2 rounded-2xl border px-6 py-7 text-center">
            <span className="bg-muted mb-1 flex size-10 items-center justify-center rounded-full">
              <HugeiconsIcon icon={PackageIcon} className="size-5" />
            </span>
            <p className="text-sm font-[550]">{t("Get started by creating a new project")}</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {t("Projects help you set common instructions for conversations.")}
            </p>
            <button
              type="button"
              onClick={create}
              className="border-foreground/15 hover:bg-muted mt-2 flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium"
            >
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              {t("New project")}
            </button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
      <NewProjectDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
};
