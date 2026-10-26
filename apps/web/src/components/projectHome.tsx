"use client";

import { useAccount } from "@/components/account";
import { Composer } from "@/components/composer";
import { saveDraft } from "@/components/draft";
import { useT } from "@/components/i18n";
import { ProjectIcon } from "@/components/projectIcon";
import { ProjectPanel } from "@/components/projectPanel";
import { useProjects } from "@/components/projects";
import { SessionRow } from "@/components/sessionMenu";
import { useSessions } from "@/components/sessions";
import { cn } from "@/lib/utils";
import { IconLayoutSidebarRightExpand } from "@tabler/icons-react";
import { type FC, useEffect, useState } from "react";

const PANE_KEY = "sirathicProjectPane";

const readPaneOpen = () => {
  try {
    return localStorage.getItem(PANE_KEY) !== "closed";
  } catch {
    return true;
  }
};

const writePaneOpen = (open: boolean) => {
  try {
    localStorage.setItem(PANE_KEY, open ? "open" : "closed");
  } catch {
    return;
  }
};

export const ProjectHome: FC<{ id: string }> = ({ id }) => {
  const project = useProjects((s) => s.projects?.find((found) => found.id === id));
  const loaded = useProjects((s) => s.projects !== undefined);
  const signedOut = useAccount((s) => s.status?.signedIn === false);
  const sessions = useSessions((s) => s.sessions);
  const [expanded, setExpanded] = useState(false);
  const [paneOpen, setPaneOpen] = useState(readPaneOpen);
  const t = useT();
  const chats = sessions?.filter((session) => session.projectId === id) ?? [];
  const missing = signedOut || (loaded && !project);

  useEffect(() => {
    if (missing) window.location.replace("/");
  }, [missing]);

  useEffect(() => {
    if (!project) return;
    const previous = document.title;
    document.title = `${project.name} - Sirathic`;
    return () => {
      document.title = previous;
    };
  }, [project]);

  if (!project) return null;

  const togglePane = () => {
    writePaneOpen(!paneOpen);
    setPaneOpen(!paneOpen);
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {!paneOpen && (
        <button
          type="button"
          onClick={togglePane}
          aria-label={t("Show project settings")}
          title={t("Show project settings")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 end-4 z-10 hidden size-8 items-center justify-center rounded-full lg:flex"
        >
          <IconLayoutSidebarRightExpand className="size-5" />
        </button>
      )}
      <div
        className={cn(
          "flex min-w-0 flex-col px-4 pb-10 md:px-6 lg:flex-1 lg:overflow-y-auto",
          expanded && paneOpen && "lg:hidden",
        )}
      >
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 pt-16 md:pt-[22vh]">
          <h1 className="flex min-w-0 items-center justify-center gap-2 text-2xl font-[550]">
            {project.icon && <ProjectIcon icon={project.icon} className="size-6 shrink-0" />}
            <span className="truncate">{project.name}</span>
          </h1>
          <Composer
            placeholder={t("Ask anything…")}
            menuSide="bottom"
            project={{
              id: project.id,
              name: project.name,
              icon: project.icon,
              leaveLabel: t("Leave project"),
              onLeave: (text) => {
                saveDraft(text);
                window.location.assign("/");
              },
            }}
          />
          <div className="flex flex-col gap-0.5">
            {chats.length === 0 && (
              <p className="text-muted-foreground/70 px-2.5 text-sm">{t("No chats yet")}</p>
            )}
            {chats.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        </div>
      </div>
      <aside
        className={cn(
          "shrink-0 px-4 pb-10 lg:p-2",
          expanded ? "lg:min-w-0 lg:flex-1" : "lg:w-[min(604px,50%)]",
          !paneOpen && "lg:hidden",
        )}
      >
        <ProjectPanel
          project={project}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
          onCollapse={togglePane}
        />
      </aside>
    </div>
  );
};
