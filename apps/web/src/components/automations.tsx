"use client";

import { useAccount } from "@/components/account";
import { blankDraft, type Draft, draftOf } from "@/components/automationDraft";
import { AutomationEditor } from "@/components/automationEditor";
import { type Automation, describeSchedule, formatInstant } from "@/components/automationText";
import { type Translate, useLocale, useT } from "@/components/i18n";
import { ProjectIcon } from "@/components/projectIcon";
import { useProjects } from "@/components/projects";
import {
  menuIcon,
  menuItem,
  Modal,
  modalButton,
  modalPrimaryButton,
} from "@/components/sessionMenu";
import { useSignIn } from "@/components/signIn";
import { tabClass } from "@/components/tabLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  IconBolt,
  IconBook2,
  IconBookmark,
  IconBooks,
  IconBuildingMosque,
  IconClockPlay,
  IconDots,
  IconLanguage,
  IconMoodKid,
  IconMoon,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPray,
  IconScale,
  IconSunrise,
  IconSunset2,
  IconTent,
  IconTrash,
  IconUsersGroup,
} from "@tabler/icons-react";
import Link from "next/link";
import { type FC, useCallback, useEffect, useState } from "react";

type Run = Awaited<ReturnType<typeof api.automations.runs.query>>[number];

type Editing = { automation: Automation | undefined; draft: Draft };

const templateGroups = (t: Translate) =>
  [
    {
      title: t("Daily"),
      tile: "bg-sky-500",
      templates: [
        {
          icon: IconBook2,
          name: t("Daily hadith"),
          prompt: t("Share one authentic hadith with its grading and a short explanation."),
          schedule: { kind: "daily", time: "06:00" },
        },
        {
          icon: IconSunrise,
          name: t("Morning adhkar"),
          prompt: t("Give me the morning adhkar with their sources and when to say them."),
          schedule: { kind: "daily", time: "05:30" },
        },
        {
          icon: IconSunset2,
          name: t("Evening adhkar"),
          prompt: t("Give me the evening adhkar with their sources and when to say them."),
          schedule: { kind: "daily", time: "17:30" },
        },
        {
          icon: IconBookmark,
          name: t("Verse of the day"),
          prompt: t("Share one verse of the Quran with its translation and a short tafsir."),
          schedule: { kind: "daily", time: "07:00" },
        },
      ],
    },
    {
      title: t("Learning"),
      tile: "bg-violet-500",
      templates: [
        {
          icon: IconBooks,
          name: t("Weekly tafsir"),
          prompt: t("Explain a few verses of a short surah from the classical tafsir books."),
          schedule: { kind: "weekly", days: [0], time: "09:00" },
        },
        {
          icon: IconLanguage,
          name: t("Quran word of the day"),
          prompt: t("Teach me one Arabic word from the Quran with its root and a verse using it."),
          schedule: { kind: "daily", time: "08:00" },
        },
        {
          icon: IconTent,
          name: t("Seerah story"),
          prompt: t("Tell me one story from the seerah of the Prophet ﷺ, with a lesson to take."),
          schedule: { kind: "weekly", days: [6], time: "10:00" },
        },
        {
          icon: IconScale,
          name: t("Fiqh question explained"),
          prompt: t("Explain one everyday fiqh question with the view of each madhhab."),
          schedule: { kind: "weekly", days: [3], time: "20:00" },
        },
      ],
    },
    {
      title: t("Worship"),
      tile: "bg-emerald-600",
      templates: [
        {
          icon: IconBuildingMosque,
          name: t("Friday reminder"),
          prompt: t("Remind me of the sunnah of Friday with one relevant hadith."),
          schedule: { kind: "weekly", days: [5], time: "11:00" },
        },
        {
          icon: IconMoon,
          name: t("Monday and Thursday fast"),
          prompt: t("Remind me that tomorrow is a sunnah fast day, with a hadith on its reward."),
          schedule: { kind: "weekly", days: [0, 3], time: "20:00" },
        },
        {
          icon: IconPray,
          name: t("Nightly dua"),
          prompt: t("Give me one authentic dua for the night with its meaning and source."),
          schedule: { kind: "daily", time: "21:30" },
        },
      ],
    },
    {
      title: t("Family"),
      tile: "bg-amber-500",
      templates: [
        {
          icon: IconMoodKid,
          name: t("Prophet story for kids"),
          prompt: t("Tell a short story of a prophet for children, in simple words."),
          schedule: { kind: "daily", time: "19:30" },
        },
        {
          icon: IconUsersGroup,
          name: t("Family halaqa"),
          prompt: t("Suggest a topic for our family halaqa, with a verse, a hadith and questions."),
          schedule: { kind: "weekly", days: [5], time: "18:00" },
        },
      ],
    },
  ] as const;

const pillButton =
  "h-8 shrink-0 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50";

const Tabs: FC<{
  tab: "automations" | "runs";
  onChange: (tab: "automations" | "runs") => void;
}> = ({ tab, onChange }) => {
  const t = useT();
  const entries = [
    ["automations", t("Automations")],
    ["runs", t("Runs")],
  ] as const;
  return (
    <div role="tablist" className="flex flex-1 items-center gap-1">
      {entries.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onChange(id)}
          className={tabClass(tab === id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

type RowActions = {
  onEdit: () => void;
  onToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
};

const AutomationMenu: FC<RowActions & { enabled: boolean; busy: boolean }> = ({
  enabled,
  busy,
  onEdit,
  onToggle,
  onRunNow,
  onDelete,
}) => {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("More actions")}
        disabled={busy}
        className="text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground grid size-8 shrink-0 place-items-center rounded-[8px] transition-colors disabled:opacity-50"
      >
        <IconDots className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-[16px] p-1.5">
        <DropdownMenuItem onSelect={onEdit} className={menuItem}>
          <IconPencil className={menuIcon} />
          {t("Edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggle} className={menuItem}>
          {enabled ? (
            <IconPlayerPause className={menuIcon} />
          ) : (
            <IconPlayerPlay className={menuIcon} />
          )}
          {enabled ? t("Pause") : t("Resume")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRunNow} className={menuItem}>
          <IconBolt className={menuIcon} />
          {t("Run now")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete} className={menuItem}>
          <IconTrash className="size-[18px]" />
          {t("Delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AutomationRow: FC<RowActions & { automation: Automation; busy: boolean }> = ({
  automation,
  busy,
  ...actions
}) => {
  const t = useT();
  const locale = useLocale();
  const project = useProjects((s) =>
    s.projects?.find((found) => found.id === automation.projectId),
  );
  const status = automation.enabled
    ? automation.nextRunAt &&
      t("Next run {time}", { time: formatInstant(locale, automation.nextRunAt) })
    : t("Paused");
  return (
    <div className="flex min-h-16 min-w-0 items-center gap-3 py-2">
      <button
        type="button"
        onClick={actions.onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-[10px]">
          <ProjectIcon icon={automation.icon} blank={IconClockPlay} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{automation.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {describeSchedule(t, locale, automation.schedule)}
          </span>
          <span className="text-muted-foreground truncate text-xs">{status}</span>
          {project && (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
              <ProjectIcon icon={project.icon} className="size-3 shrink-0" />
              <span className="truncate">{project.name}</span>
            </span>
          )}
          {automation.lastRunAt && (
            <span className="text-muted-foreground truncate text-xs">
              {t("Last run {time}", { time: formatInstant(locale, automation.lastRunAt) })}
            </span>
          )}
        </span>
      </button>
      <AutomationMenu enabled={automation.enabled} busy={busy} {...actions} />
    </div>
  );
};

const RunsList: FC<{ runs: Run[] }> = ({ runs }) => {
  const t = useT();
  const locale = useLocale();
  if (runs.length === 0) {
    return (
      <p className="text-muted-foreground bg-muted/40 rounded-2xl py-12 text-center text-sm">
        {t("No runs yet")}
      </p>
    );
  }
  return (
    <div className="max-w-2xl">
      {runs.map((run) => (
        <Link
          key={run.id}
          href={`/c/${run.id}`}
          className="hover:bg-muted/50 flex min-h-14 min-w-0 items-center gap-3 rounded-lg py-2"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("truncate text-sm", run.unread ? "font-semibold" : "font-medium")}>
              {run.title}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {formatInstant(locale, run.createdAt)}
            </span>
          </span>
          {run.unread && (
            <span aria-hidden className="bg-foreground size-2 shrink-0 rounded-full" />
          )}
        </Link>
      ))}
    </div>
  );
};

export const Automations: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const ask = useSignIn((s) => s.ask);
  const [tab, setTab] = useState<"automations" | "runs">("automations");
  const [automations, setAutomations] = useState<Automation[]>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [editing, setEditing] = useState<Editing>();
  const [busy, setBusy] = useState<string>();
  const [deleting, setDeleting] = useState<Automation>();
  const [notice, setNotice] = useState<string>();
  const t = useT();

  const refresh = useCallback(async () => {
    const [found, ran] = await Promise.all([
      api.automations.list.query().catch(() => undefined),
      api.automations.runs.query().catch(() => undefined),
    ]);
    setAutomations((current) => found ?? current ?? []);
    if (ran) setRuns(ran);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const act = async <Result,>(
    automation: Automation,
    work: () => Promise<Result>,
    done: string,
  ) => {
    setBusy(automation.id);
    const worked = await work().then(
      () => true,
      () => false,
    );
    await refresh();
    setBusy(undefined);
    setNotice(worked ? done : t("Try again"));
  };

  const actionsFor = (automation: Automation): RowActions => ({
    onEdit: () => setEditing({ automation, draft: draftOf(automation) }),
    onToggle: () =>
      void act(
        automation,
        () => api.automations.update.mutate({ id: automation.id, enabled: !automation.enabled }),
        automation.enabled ? t("Automation paused") : t("Automation resumed"),
      ),
    onRunNow: () =>
      void act(
        automation,
        () => api.automations.runNow.mutate({ id: automation.id }),
        t("Running now. The answer will show up in Runs."),
      ),
    onDelete: () => setDeleting(automation),
  });

  const create = (draft: Draft) =>
    signedIn ? setEditing({ automation: undefined, draft }) : ask();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-16 lg:pt-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Tabs tab={tab} onChange={setTab} />
          <button
            type="button"
            onClick={() => create(blankDraft())}
            className="bg-foreground text-background h-9 rounded-full px-4 text-sm font-medium transition hover:opacity-85"
          >
            {t("New automation")}
          </button>
        </div>
        {signedIn === false && (
          <button type="button" onClick={() => ask()} className="text-sm underline">
            {t("Sign in to create automations.")}
          </button>
        )}
        {signedIn && tab === "runs" && <RunsList runs={runs} />}
        {signedIn && tab === "automations" && (
          <>
            <div className="max-w-2xl">
              {automations?.map((automation) => (
                <AutomationRow
                  key={automation.id}
                  automation={automation}
                  busy={busy === automation.id}
                  {...actionsFor(automation)}
                />
              ))}
            </div>
            {automations?.length === 0 && (
              <div className="flex flex-col gap-8">
                {templateGroups(t).map(({ title, tile, templates }) => (
                  <section key={title}>
                    <h2 className="mb-2 px-2 text-base font-medium">{title}</h2>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      {templates.map(({ icon: Icon, name, prompt, schedule }) => (
                        <div
                          key={name}
                          className="hover:bg-muted/50 flex min-h-16 min-w-0 items-center gap-3 rounded-xl p-2"
                        >
                          <span
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-xl text-white",
                              tile,
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{name}</span>
                            <span className="text-muted-foreground line-clamp-2 text-sm">
                              {prompt}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              create({
                                ...blankDraft(),
                                name,
                                prompt,
                                kind: schedule.kind,
                                time: schedule.time,
                                days: schedule.kind === "weekly" ? [...schedule.days] : [1],
                              })
                            }
                            className={cn(pillButton, "bg-muted hover:bg-foreground/10")}
                          >
                            {t("Add")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
        {editing && (
          <AutomationEditor
            key={editing.automation?.id ?? "new"}
            automation={editing.automation}
            draft={editing.draft}
            onClose={() => setEditing(undefined)}
            onSaved={() => void refresh()}
          />
        )}
        <Modal
          open={deleting !== undefined}
          onOpenChange={(open) => {
            if (!open) setDeleting(undefined);
          }}
          title={t("Delete this automation?")}
        >
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(undefined)} className={modalButton}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!deleting) return;
                setDeleting(undefined);
                void act(
                  deleting,
                  () => api.automations.remove.mutate({ id: deleting.id }),
                  t("Automation deleted"),
                );
              }}
              className={cn(modalPrimaryButton, "bg-destructive text-white")}
            >
              {t("Delete")}
            </button>
          </div>
        </Modal>
        {notice && (
          <p
            role="status"
            className="bg-fill border-border fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border px-3 py-2 text-sm shadow-lg"
          >
            {notice}
          </p>
        )}
      </div>
    </div>
  );
};
