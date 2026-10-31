import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BotAvatar } from "@/components/bot-avatar";
import { openBot } from "@/components/bot-switcher";
import { AlertCircle, Check, ChevronDown } from "@/components/icons";
import { Page } from "@/components/page";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { type Bot, useBots } from "@/lib/bots";

type Task = Awaited<ReturnType<typeof api.tasks.list.query>>[number];

const POLL_MS = 4000;

const SORTS = [
  ["status", "Status"],
  ["bot", "Bot"],
] as const;

const sectionOf = (task: Task) =>
  task.state === "running"
    ? "progress"
    : task.state === "failed" || task.state === "cutOff"
      ? "attention"
      : "done";

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

const stepText = (now: Task["now"]) => {
  switch (now?.tool) {
    case "search_web":
      return now.detail ? `Searching “${now.detail}”` : "Working";
    case "fetch_url":
      return now.detail ? `Reading ${siteOf(now.detail)}` : "Working";
    case "code_execution":
      return "Running code";
    default:
      return "Working";
  }
};

const Row = ({ task, bot }: { task: Task; bot: Bot | undefined }) => {
  const section = sectionOf(task);
  return (
    <Pressable
      onPress={() => openBot(task.botId)}
      className="active:bg-muted flex-row items-center gap-3 px-4 py-3"
    >
      {section === "progress" ? (
        <ActivityIndicator colorClassName="accent-muted-foreground" />
      ) : section === "attention" ? (
        <AlertCircle size={22} strokeWidth={1.75} colorClassName="accent-amber-400" />
      ) : (
        <Check size={22} strokeWidth={2} colorClassName="accent-green-500" />
      )}
      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className={`font-sans text-base ${section === "done" ? "text-muted-foreground" : "text-foreground"}`}
        >
          {task.title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {bot && <BotAvatar color={bot.color} body={bot.symbol} seed={bot.id} size={16} />}
          <Text numberOfLines={1} className="text-muted-foreground font-sans flex-shrink text-xs">
            {bot?.name}
            {section === "progress" && ` · ${stepText(task.now)}`}
            {task.state === "stopped" && " · Stopped"}
          </Text>
          {section === "attention" && (
            <Text className="font-sans text-xs text-amber-400">· Didn't finish</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const Group = ({
  title,
  tasks,
  bots,
}: {
  title: string;
  tasks: Task[];
  bots: Bot[] | undefined;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <View className="mb-5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="mb-2 flex-row items-center gap-1 self-start"
      >
        <Text className="text-muted-foreground font-sans text-sm">{title}</Text>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          colorClassName="accent-muted-foreground"
          style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }}
        />
      </Pressable>
      {open && (
        <View className="bg-card border-border overflow-hidden rounded-xl border">
          {tasks.map((task) => (
            <Row key={task.id} task={task} bot={bots?.find((bot) => bot.id === task.botId)} />
          ))}
        </View>
      )}
    </View>
  );
};

export default function Tasks() {
  const signedIn = authClient.useSession().data?.user !== undefined;
  const bots = useBots((s) => s.bots);
  const [tasks, setTasks] = useState<Task[]>();
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("status");
  const running = tasks?.some((task) => task.state === "running") === true;

  useEffect(() => {
    if (!signedIn) return;
    const load = () =>
      api.tasks.list.query().then(
        (found) => setTasks(found),
        () => undefined,
      );
    void load();
    void useBots.getState().refresh();
    if (!running) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [signedIn, running]);

  const sections = [
    ["attention", "Needs attention"],
    ["progress", "In progress"],
    ["done", "Done"],
  ] as const;
  const byBot = [...new Set((tasks ?? []).map((task) => task.botId))].map((id) => ({
    id,
    title: bots?.find((bot) => bot.id === id)?.name ?? "",
    tasks: (tasks ?? []).filter((task) => task.botId === id),
  }));

  return (
    <Page title="Tasks">
      {tasks !== undefined && tasks.length > 0 && (
        <Text className="text-muted-foreground font-sans mb-4 text-sm">
          {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
        </Text>
      )}
      <View className="mb-5 flex-row items-center gap-1">
        <Text className="text-muted-foreground font-sans pe-2 text-sm">Sort by</Text>
        {SORTS.map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityState={{ selected: sort === id }}
            onPress={() => setSort(id)}
            className={`h-9 items-center justify-center rounded-lg px-3 ${sort === id ? "bg-muted" : ""}`}
          >
            <Text
              className={`font-sans text-sm ${sort === id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tasks?.length === 0 && (
        <Text className="text-muted-foreground font-sans text-sm">
          Ask a bot for a few things at once and each one shows up here.
        </Text>
      )}
      {sort === "status"
        ? sections.map(([id, title]) => {
            const own = (tasks ?? []).filter((task) => sectionOf(task) === id);
            return own.length > 0 && <Group key={id} title={title} tasks={own} bots={bots} />;
          })
        : byBot.map(({ id, title, tasks: own }) => (
            <Group key={id} title={title} tasks={own} bots={bots} />
          ))}
    </Page>
  );
}
