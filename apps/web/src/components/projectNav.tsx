"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { ProjectIcon } from "@/components/projectIcon";
import { field, ProjectActions } from "@/components/projectMenu";
import { MEMORY_OPTIONS, type Project, projectNameError, useProjects } from "@/components/projects";
import { Modal, modalButton, modalPrimaryButton, SessionRow } from "@/components/sessionMenu";
import { useSessions } from "@/components/sessions";
import { cn } from "@/lib/utils";
import { PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowDown01Icon, Edit02Icon, GridViewIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { type FC, type FormEvent, useState } from "react";

const onHover =
  "hidden group-focus-within/project:flex group-hover/project:flex group-has-[[data-state=open]]/project:flex pointer-coarse:flex";

const MemoryChoice: FC<{ value: boolean; onChange: (projectOnly: boolean) => void }> = ({
  value,
  onChange,
}) => {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("Memory")} className="flex flex-col gap-1.5 text-sm">
      {t("Memory")}
      {MEMORY_OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.projectOnly}
          onClick={() => onChange(option.projectOnly)}
          className={cn(
            "border-border hover:bg-muted flex flex-col rounded-[10px] border px-3 py-2 text-start",
            value === option.projectOnly && "border-foreground/40 bg-muted",
          )}
        >
          <span className="font-medium">{t(option.label)}</span>
          <span className="text-muted-foreground text-[13px]">{t(option.hint)}</span>
        </button>
      ))}
    </div>
  );
};

export const NewProjectDialog: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}> = ({ open, onOpenChange, onCreated }) => {
  const create = useProjects((s) => s.create);
  const router = useRouter();
  const [name, setName] = useState("");
  const [projectOnlyMemory, setProjectOnlyMemory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const t = useT();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    const invalid = projectNameError(t, trimmed);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    const created = await create(trimmed, projectOnlyMemory);
    setBusy(false);
    if (!created) {
      setError(t("Could not create the project. Try again, or delete one if you have 50."));
      return;
    }
    setName("");
    onOpenChange(false);
    onCreated?.();
    router.push(`/project/${created.id}`);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("Create project")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          {t("Project name")}
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            maxLength={PROJECT_NAME_MAX}
            aria-invalid={error !== undefined}
            autoFocus
            className={`${field} h-9`}
          />
          {error && <span className="text-destructive">{error}</span>}
        </label>
        <MemoryChoice value={projectOnlyMemory} onChange={setProjectOnlyMemory} />
        <div className="flex justify-end gap-2">
          <Dialog.Close type="button" className={modalButton}>
            {t("Cancel")}
          </Dialog.Close>
          <button type="submit" disabled={!name.trim() || busy} className={modalPrimaryButton}>
            {t("Create")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ProjectRow: FC<{ project: Project; onDone?: () => void }> = ({ project, onDone }) => {
  const pathname = usePathname();
  const sessions = useSessions((s) => s.sessions);
  const t = useT();
  const href = `/project/${project.id}`;
  const chats = (sessions?.filter((session) => session.projectId === project.id) ?? []).toSorted(
    (a, b) => Number(b.pinned) - Number(a.pinned),
  );
  const inside = pathname === href || chats.some((chat) => pathname === `/c/${chat.id}`);

  return (
    <>
      <div
        className={cn(
          "group/project hover:bg-muted flex items-center gap-0.5 rounded-[12px] pe-1.5",
          pathname === href && "bg-muted",
        )}
      >
        <Link
          href={href}
          onClick={onDone}
          className="text-foreground flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-sm"
        >
          <ProjectIcon
            icon={project.icon}
            open={inside}
            className="text-muted-foreground size-4 shrink-0"
          />
          <span className="truncate group-hover/project:[text-overflow:clip]">{project.name}</span>
        </Link>
        <ProjectActions
          project={project}
          align="start"
          triggerClassName={cn(
            "text-muted-foreground hover:text-foreground size-6 shrink-0 items-center justify-center rounded-md",
            onHover,
          )}
        />
        <Link
          href={href}
          onClick={onDone}
          aria-label={t("New chat in project")}
          title={t("New chat in project")}
          className={cn(
            "text-muted-foreground hover:text-foreground size-6 shrink-0 items-center justify-center rounded-md",
            onHover,
          )}
        >
          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
        </Link>
      </div>
      {chats.map((session) => (
        <SessionRow key={session.id} session={session} onOpen={onDone} nested />
      ))}
    </>
  );
};

export const ProjectList: FC<{ onDone?: () => void }> = ({ onDone }) => {
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const projects = useProjects((s) => s.projects);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);
  const t = useT();

  if (!signedIn) return null;

  return (
    <>
      <div className="text-muted-foreground flex items-center gap-1 ps-2.5 pt-6 pb-1 text-sm">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="group/projects hover:text-foreground flex min-w-0 flex-1 items-center gap-1 text-start"
        >
          {t("Projects")}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn(
              "size-3.5 opacity-0 group-hover/sidebar:opacity-100 group-focus-visible/projects:opacity-100 pointer-coarse:opacity-100",
              !open && "-rotate-90 opacity-100",
            )}
          />
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/sidebar:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Link
            href="/project"
            onClick={onDone}
            aria-label={t("All projects")}
            title={t("All projects")}
            className="hover:bg-muted hover:text-foreground flex size-5 items-center justify-center rounded-md"
          >
            <HugeiconsIcon icon={GridViewIcon} className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label={t("New project")}
            title={t("New project")}
            onClick={() => setAdding(true)}
            className="hover:bg-muted hover:text-foreground flex size-5 items-center justify-center rounded-md"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </button>
        </div>
      </div>
      {open &&
        projects?.map((project) => (
          <ProjectRow key={project.id} project={project} onDone={onDone} />
        ))}
      <NewProjectDialog open={adding} onOpenChange={setAdding} onCreated={onDone} />
    </>
  );
};
