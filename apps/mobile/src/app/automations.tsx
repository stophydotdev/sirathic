import { blankDraft, type Draft, draftOf } from "@sirathic/app/automationDraft";
import { router } from "expo-router";
import { type FC, useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AutomationEditor } from "@/components/automation-editor";
import { AutomationIdeas } from "@/components/automation-ideas";
import { useConfirm } from "@/components/confirm";
import { Bolt, Dots, Pencil, PlayerPause, PlayerPlay, Plus, Trash } from "@/components/icons";
import { Menu, menuRow, menuText } from "@/components/menu";
import { Page, Tabs } from "@/components/page";
import { ProjectIcon } from "@/components/project-icon";
import { useSignIn } from "@/components/sign-in";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { type Automation, describeSchedule, formatInstant, type Run } from "@/lib/automations";
import { useChatState } from "@/lib/chat-state";

const TABS = [
  ["automations", "Automations"],
  ["runs", "Runs"],
  ["ideas", "Ideas"],
] as const;

type Tab = (typeof TABS)[number][0];

type Editing = { automation: Automation | undefined; draft: Draft };

type RowActions = {
  onEdit: () => void;
  onToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
};

const MenuItem: FC<{
  label: string;
  Icon: typeof Pencil;
  danger?: boolean;
  onPress: () => void;
}> = ({ label, Icon, danger = false, onPress }) => (
  <Pressable onPress={onPress} className={menuRow}>
    <Icon
      size={20}
      strokeWidth={1.75}
      colorClassName={danger ? "accent-destructive" : "accent-foreground"}
    />
    <Text className={danger ? "text-destructive font-sans text-sm" : menuText}>{label}</Text>
  </Pressable>
);

const AutomationRow: FC<RowActions & { automation: Automation; busy: boolean }> = ({
  automation,
  busy,
  ...actions
}) => {
  const status = automation.enabled
    ? automation.nextRunAt && `Next run ${formatInstant(automation.nextRunAt)}`
    : "Paused";
  return (
    <View className="min-h-16 flex-row items-center gap-3 py-2">
      <Pressable onPress={actions.onEdit} className="flex-1 flex-row items-center gap-3">
        <View className="bg-muted size-9 items-center justify-center rounded-[10px]">
          <ProjectIcon icon={automation.icon} />
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-foreground font-medium text-sm">
            {automation.name}
          </Text>
          <Text numberOfLines={1} className="text-muted-foreground font-sans text-xs">
            {describeSchedule(automation.schedule)}
          </Text>
          {status && (
            <Text numberOfLines={1} className="text-muted-foreground font-sans text-xs">
              {status}
            </Text>
          )}
          {automation.lastRunAt && (
            <Text numberOfLines={1} className="text-muted-foreground font-sans text-xs">
              {`Last run ${formatInstant(automation.lastRunAt)}`}
            </Text>
          )}
        </View>
      </Pressable>
      <Menu
        label="More actions"
        align="end"
        trigger={<Dots size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
        triggerClassName={`active:bg-muted size-8 items-center justify-center rounded-md ${busy ? "opacity-50" : ""}`}
        contentClassName="w-44"
      >
        {(close) => {
          const then = (action: () => void) => () => {
            close();
            action();
          };
          return (
            <>
              <MenuItem label="Edit" Icon={Pencil} onPress={then(actions.onEdit)} />
              <MenuItem
                label={automation.enabled ? "Pause" : "Resume"}
                Icon={automation.enabled ? PlayerPause : PlayerPlay}
                onPress={then(actions.onToggle)}
              />
              <MenuItem label="Run now" Icon={Bolt} onPress={then(actions.onRunNow)} />
              <MenuItem label="Delete" Icon={Trash} danger onPress={then(actions.onDelete)} />
            </>
          );
        }}
      </Menu>
    </View>
  );
};

const RunsList: FC<{ runs: Run[] }> = ({ runs }) => {
  const open = useChatState((s) => s.open);
  if (runs.length === 0) {
    return (
      <Text className="text-muted-foreground font-sans bg-muted/40 overflow-hidden rounded-2xl py-12 text-center text-sm">
        No runs yet
      </Text>
    );
  }
  return runs.map((run) => (
    <Pressable
      key={run.id}
      onPress={() => {
        open(run.id);
        router.navigate("/");
      }}
      className="active:bg-muted/50 min-h-14 flex-row items-center gap-3 rounded-lg py-2"
    >
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={`text-foreground text-sm ${run.unread ? "font-semibold" : "font-medium"}`}
        >
          {run.title}
        </Text>
        <Text className="text-muted-foreground font-sans text-xs">
          {formatInstant(run.createdAt)}
        </Text>
      </View>
      {run.unread && <View className="bg-foreground size-2 rounded-full" />}
    </Pressable>
  ));
};

export default function Automations() {
  const signedIn = authClient.useSession().data !== null;
  const ask = useSignIn((s) => s.ask);
  const [tab, setTab] = useState<Tab>("automations");
  const [automations, setAutomations] = useState<Automation[]>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [editing, setEditing] = useState<Editing>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<string>();

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
    setNotice(worked ? done : "Try again");
  };

  const actionsFor = (automation: Automation): RowActions => ({
    onEdit: () => setEditing({ automation, draft: draftOf(automation) }),
    onToggle: () =>
      void act(
        automation,
        () => api.automations.update.mutate({ id: automation.id, enabled: !automation.enabled }),
        automation.enabled ? "Automation paused" : "Automation resumed",
      ),
    onRunNow: () =>
      void act(
        automation,
        () => api.automations.runNow.mutate({ id: automation.id }),
        "Running now. The answer will show up in Runs.",
      ),
    onDelete: () =>
      useConfirm.getState().ask({
        title: "Delete this automation?",
        action: "Delete",
        danger: true,
        onConfirm: () =>
          void act(
            automation,
            () => api.automations.remove.mutate({ id: automation.id }),
            "Automation deleted",
          ),
      }),
  });

  const create = (draft: Draft) =>
    signedIn ? setEditing({ automation: undefined, draft }) : ask();

  return (
    <View className="flex-1">
      <Page title="Automations">
        <View className="flex-row items-start justify-between gap-3">
          <Tabs tabs={TABS} tab={tab} onChange={setTab} />
          <Pressable
            accessibilityLabel="New automation"
            onPress={() => create(blankDraft())}
            className="bg-foreground active:opacity-85 size-9 items-center justify-center rounded-full"
          >
            <Plus size={22} strokeWidth={2} colorClassName="accent-background" />
          </Pressable>
        </View>
        {!signedIn && (
          <>
            <View className="border-border mb-8 flex-row items-center gap-3 rounded-2xl border py-2 ps-4 pe-2">
              <Text className="text-muted-foreground font-sans flex-1 text-sm">
                Sign in to create automations.
              </Text>
              <Pressable
                onPress={() => ask()}
                className="bg-muted active:bg-foreground/10 h-9 items-center justify-center rounded-full px-4"
              >
                <Text className="text-foreground font-medium text-sm">Sign in</Text>
              </Pressable>
            </View>
            {tab !== "runs" && <AutomationIdeas onAdd={create} />}
          </>
        )}
        {signedIn && tab === "runs" && <RunsList runs={runs} />}
        {signedIn && tab === "ideas" && <AutomationIdeas onAdd={create} />}
        {signedIn && tab === "automations" && (
          <>
            {automations?.map((automation) => (
              <AutomationRow
                key={automation.id}
                automation={automation}
                busy={busy === automation.id}
                {...actionsFor(automation)}
              />
            ))}
            {automations && (
              <View className={automations.length > 0 ? "mt-8" : undefined}>
                <AutomationIdeas onAdd={create} />
              </View>
            )}
          </>
        )}
      </Page>
      {editing && (
        <AutomationEditor
          key={editing.automation?.id ?? "new"}
          automation={editing.automation}
          draft={editing.draft}
          onClose={() => setEditing(undefined)}
          onSaved={() => void refresh()}
        />
      )}
      {notice && (
        <View
          pointerEvents="none"
          className="bottom-safe-offset-6 absolute inset-x-0 items-center px-6"
        >
          <Text className="bg-card border-border text-foreground font-sans overflow-hidden rounded-[10px] border px-3 py-2 text-sm shadow-lg">
            {notice}
          </Text>
        </View>
      )}
    </View>
  );
}
