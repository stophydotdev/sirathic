"use client";

import { useAccount } from "@/components/account";
import { blankDraft, type Draft, draftOf } from "@sirathic/app/automationDraft";
import { AutomationEditor } from "@/components/automationEditor";
import { AutomationIdeas } from "@/components/automationIdeas";
import { type Automation, describeSchedule, formatInstant } from "@/components/automationText";
import { useLocale, useT } from "@/components/i18n";
import { ProjectIcon } from "@/components/projectIcon";
import {
  menuIcon,
  menuItem,
  Modal,
  modalButton,
  modalPrimaryButton,
} from "@/components/sessionMenu";
import { useSignIn } from "@/components/signIn";
import { TabBar, TabPill, tabClass, useTabSlide } from "@/components/tabLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  FlashIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  TimeScheduleIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type FC, useCallback, useEffect, useState } from "react";

type Run = Awaited<ReturnType<typeof api.automations.runs.query>>[number];

type Editing = { automation: Automation | undefined; draft: Draft };

const TABS = ["automations", "runs", "ideas"] as const;

type Tab = (typeof TABS)[number];

const Tabs: FC<{ tab: Tab; onChange: (tab: Tab) => void }> = ({ tab, onChange }) => {
  const t = useT();
  const entries = [
    ["automations", t("Automations")],
    ["runs", t("Runs")],
    ["ideas", t("Ideas")],
  ] as const;
  return (
    <div role="tablist" className="relative flex flex-1 items-center gap-1">
      <TabPill />
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
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-[16px] p-1.5">
        <DropdownMenuItem onSelect={onEdit} className={menuItem}>
          <HugeiconsIcon icon={PencilEdit02Icon} className={menuIcon} />
          {t("Edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onToggle} className={menuItem}>
          {enabled ? (
            <HugeiconsIcon icon={PauseIcon} className={menuIcon} />
          ) : (
            <HugeiconsIcon icon={PlayIcon} className={menuIcon} />
          )}
          {enabled ? t("Pause") : t("Resume")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRunNow} className={menuItem}>
          <HugeiconsIcon icon={FlashIcon} className={menuIcon} />
          {t("Run now")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onDelete} className={menuItem}>
          <HugeiconsIcon icon={Delete02Icon} className="size-[18px]" />
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
          <ProjectIcon icon={automation.icon} blank={TimeScheduleIcon} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{automation.name}</span>
          <span className="text-muted-foreground truncate text-xs">
            {describeSchedule(t, locale, automation.schedule)}
          </span>
          <span className="text-muted-foreground truncate text-xs">{status}</span>
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

const lastAutomations = new Map<string, Automation[]>();
const lastRuns = new Map<string, Run[]>();

export const Automations: FC = () => {
  const signedIn = useAccount((s) => s.status?.signedIn);
  const account = useAccount((s) => (s.status?.signedIn ? s.status.label : undefined));
  const ask = useSignIn((s) => s.ask);
  const [tab, setTab] = useState<Tab>("automations");
  const slide = useTabSlide(TABS, tab);
  const [automations, setAutomations] = useState(() =>
    account ? lastAutomations.get(account) : undefined,
  );
  const [runs, setRuns] = useState(() => (account ? lastRuns.get(account) : undefined) ?? []);
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
    if (!account) return;
    if (automations) lastAutomations.set(account, automations);
    lastRuns.set(account, runs);
  }, [account, automations, runs]);

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
        <TabBar className="flex flex-wrap items-center gap-3">
          <Tabs tab={tab} onChange={setTab} />
          <button
            type="button"
            onClick={() => create(blankDraft())}
            className="bg-foreground text-background h-9 rounded-full px-4 text-sm font-medium transition hover:opacity-85"
          >
            {t("New automation")}
          </button>
        </TabBar>
        <div key={tab} className={slide}>
          {signedIn === false && (
            <>
              <div className="border-border mb-8 flex items-center gap-3 rounded-2xl border py-2 ps-4 pe-2">
                <p className="text-muted-foreground flex-1 text-sm">
                  {t("Sign in to create automations.")}
                </p>
                <button
                  type="button"
                  onClick={() => ask()}
                  className="bg-muted hover:bg-foreground/10 h-9 rounded-full px-4 text-sm font-medium transition-colors"
                >
                  {t("Sign in")}
                </button>
              </div>
              {tab !== "runs" && <AutomationIdeas onAdd={create} />}
            </>
          )}
          {signedIn && tab === "runs" && <RunsList runs={runs} />}
          {signedIn && tab === "ideas" && <AutomationIdeas onAdd={create} />}
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
              {automations?.length === 0 && <AutomationIdeas onAdd={create} />}
            </>
          )}
        </div>
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
