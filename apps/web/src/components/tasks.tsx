"use client";

import { useAccount } from "@/components/account";
import { BotAvatar } from "@/components/botAvatar";
import { type Translate, useT } from "@/components/i18n";
import { type Project, useProjects } from "@/components/projects";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, useEffect, useState } from "react";

type Task = Awaited<ReturnType<typeof api.tasks.list.query>>[number];

const POLL_MS = 4000;

const SORTS = ["status", "bot"] as const;

const sectionOf = (task: Task) =>
  task.state === "running"
    ? "progress"
    : task.state === "failed" || task.state === "cutOff"
      ? "attention"
      : "done";

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

const stepText = (t: Translate, now: Task["now"]) => {
  switch (now?.tool) {
    case "search_web":
      return now.detail ? t("Searching “{query}”", { query: now.detail }) : t("Working");
    case "fetch_url":
      return now.detail ? t("Reading {name}", { name: siteOf(now.detail) }) : t("Working");
    case "code_execution":
      return t("Running code");
    default:
      return t("Working");
  }
};

const StateIcon: FC<{ task: Task }> = ({ task }) => {
  const section = sectionOf(task);
  if (section === "progress") {
    return (
      <HugeiconsIcon
        icon={Loading03Icon}
        className="text-muted-foreground size-5 shrink-0 animate-spin motion-reduce:animate-none"
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={section === "attention" ? AlertCircleIcon : CheckmarkCircle02Icon}
      className={cn(
        "size-5 shrink-0",
        section === "attention" ? "text-amber-400" : "text-green-500",
      )}
    />
  );
};

const Row: FC<{ task: Task; bot: Project | undefined }> = ({ task, bot }) => {
  const t = useT();
  const section = sectionOf(task);
  return (
    <Link
      href={`/bot/${task.botId}`}
      className="hover:bg-muted flex items-center gap-3 px-4 py-3 transition-colors"
    >
      <StateIcon task={task} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-sm",
            section === "done" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          {bot && (
            <BotAvatar
              color={bot.color}
              body={bot.symbol}
              seed={bot.id}
              className="size-4 shrink-0"
            />
          )}
          <span className="truncate">
            {bot?.name}
            {section === "progress" && ` · ${stepText(t, task.now)}`}
            {task.state === "stopped" && ` · ${t("Stopped")}`}
          </span>
          {section === "attention" && (
            <span className="shrink-0 text-amber-400">· {t("Didn't finish")}</span>
          )}
        </span>
      </span>
    </Link>
  );
};

const Group: FC<{ title: string; tasks: Task[]; bots: Project[] | undefined }> = ({
  title,
  tasks,
  bots,
}) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 self-start text-sm transition-colors"
      >
        {title}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && (
        <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
          {tasks.map((task) => (
            <Row key={task.id} task={task} bot={bots?.find((bot) => bot.id === task.botId)} />
          ))}
        </div>
      )}
    </section>
  );
};

export const Tasks: FC = () => {
  const t = useT();
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const bots = useProjects((s) => s.bots);
  const [tasks, setTasks] = useState<Task[]>();
  const [sort, setSort] = useState<(typeof SORTS)[number]>("status");
  const running = tasks?.some((task) => task.state === "running") === true;

  useEffect(() => {
    if (!signedIn) return;
    const load = () =>
      api.tasks.list.query().then(
        (found) => setTasks(found),
        () => undefined,
      );
    void load();
    void useProjects.getState().refresh();
    if (!running) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [signedIn, running]);

  const sections = [
    ["attention", t("Needs attention")],
    ["progress", t("In progress")],
    ["done", t("Done")],
  ] as const;
  const byBot = [...new Set((tasks ?? []).map((task) => task.botId))].map((id) => ({
    id,
    title: bots?.find((bot) => bot.id === id)?.name ?? "",
    tasks: (tasks ?? []).filter((task) => task.botId === id),
  }));
  const sortLabel = { status: t("Status"), bot: t("Bot") };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-16 pb-16 lg:pt-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-foreground text-lg font-medium">{t("Tasks")}</h1>
          {tasks !== undefined && tasks.length > 0 && (
            <span className="text-muted-foreground text-sm">
              {tasks.length === 1 ? t("1 task") : t("{count} tasks", { count: tasks.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground pe-2">{t("Sort by")}</span>
          {SORTS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={sort === id}
              onClick={() => setSort(id)}
              className={cn(
                "h-8 rounded-lg px-3 transition-colors",
                sort === id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {sortLabel[id]}
            </button>
          ))}
        </div>
        {tasks?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t("Ask a bot for a few things at once and each one shows up here.")}
          </p>
        )}
        {sort === "status"
          ? sections.map(([id, title]) => {
              const own = (tasks ?? []).filter((task) => sectionOf(task) === id);
              return own.length > 0 && <Group key={id} title={title} tasks={own} bots={bots} />;
            })
          : byBot.map(({ id, title, tasks: own }) => (
              <Group key={id} title={title} tasks={own} bots={bots} />
            ))}
      </div>
    </div>
  );
};
