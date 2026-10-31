import { schedule } from "@sirathic/server/automations";
import { currentToolName } from "@sirathic/server/messages";
import { type Href, router } from "expo-router";
import { type FC, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { describeSchedule } from "@/lib/automations";
import { useBots } from "@/lib/bots";
import { ArrowUpRight, Brain, CalendarTime, Send, Sparkles, UserEdit, UserPlus } from "./icons";
import { ProjectIcon } from "./project-icon";

const ACTIONS = ["create", "edit", "pause", "resume", "delete"] as const;

const row = z.object({
  id: z.string(),
  name: z.string(),
  schedule,
  enabled: z.boolean(),
  projectId: z.string().nullish(),
});

const changed = row.partial().extend({
  action: z.enum(ACTIONS).catch("create"),
  id: z.string(),
  name: z.string(),
});

const renamed = z.object({ name: z.string() });

const restyled = z.union([z.object({ color: z.string() }), z.object({ body: z.string() })]);

const botRef = renamed.extend({ id: z.string() });

const sentTo = z.object({ sentTo: z.string(), id: z.string() });

const skillSaved = z.object({ action: z.enum(["write", "delete"]), name: z.string() });

const memorySaved = z.string().regex(/^(Saved|Forgot)/u);

const DONE = {
  create: "Created routine",
  edit: "Updated routine",
  pause: "Paused routine",
  resume: "Resumed routine",
  delete: "Deleted routine",
} satisfies Record<(typeof ACTIONS)[number], string>;

const CARD_TOOLS = new Set([
  "update_routine",
  "list_routines",
  "set_bot_job",
  "update_profile",
  "create_bot",
  "update_bot",
  "message_bot",
]);

const EVENT_TOOLS = new Set(["update_memory", "update_skill"]);

export const isCardTool = (name: string) => CARD_TOOLS.has(currentToolName(name));

export const isBotEvent = (name: string) => EVENT_TOOLS.has(currentToolName(name));

const EventLine: FC<{
  Icon: typeof Brain;
  label: string;
  name?: string;
  href?: Href;
  subtle?: boolean;
}> = ({ Icon, label, name, href, subtle = false }) => {
  const mark = <Icon size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />;
  return (
    <View
      className={`my-3 w-full flex-row flex-wrap items-center justify-center gap-x-1.5 ${subtle ? "opacity-70" : ""}`}
    >
      {name === undefined && mark}
      <Text className="text-muted-foreground font-sans text-xs">{label}</Text>
      {name !== undefined && (
        <>
          <Text className="text-muted-foreground font-sans text-xs">·</Text>
          {mark}
          {href ? (
            <Text
              numberOfLines={1}
              onPress={() => router.navigate(href)}
              className="text-super font-sans max-w-48 text-xs"
            >
              {name}
            </Text>
          ) : (
            <Text numberOfLines={1} className="text-foreground font-sans max-w-48 text-xs">
              {name}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

const BotRenamed: FC<{ name?: string }> = ({ name }) => {
  useEffect(() => {
    void useBots.getState().refresh();
  }, [name]);
  if (name === undefined) return null;
  return <EventLine Icon={UserEdit} label={`Renamed to ${name}`} />;
};

const BotCreated: FC<{ id: string; name: string }> = ({ id, name }) => {
  useEffect(() => {
    void useBots.getState().refresh();
  }, [id]);
  return <EventLine Icon={UserPlus} label="Created bot" name={name} href={`/bot/${id}`} />;
};

export const AutomationCard: FC<{ tool: string; output: unknown }> = ({ tool, output }) => {
  const name = currentToolName(tool);
  const made = row.safeParse(output).data;
  const change = changed.safeParse(output).data;
  const bot = renamed.safeParse(output).data;
  if ((name === "set_bot_job" || name === "update_profile" || name === "update_bot") && bot) {
    return <BotRenamed name={bot.name} />;
  }
  if (name === "update_profile" && restyled.safeParse(output).success) return <BotRenamed />;
  const created = botRef.safeParse(output).data;
  if (name === "create_bot" && created) return <BotCreated id={created.id} name={created.name} />;
  const sent = sentTo.safeParse(output).data;
  if (name === "message_bot" && sent) {
    return <EventLine Icon={Send} label="Messaged" name={sent.sentTo} href={`/bot/${sent.id}`} />;
  }
  if (name === "update_routine" && change && (made?.projectId || change.action !== "create")) {
    return (
      <EventLine
        Icon={CalendarTime}
        label={DONE[change.action]}
        name={change.name}
        href={change.action === "delete" ? undefined : "/automations"}
      />
    );
  }
  if (name !== "update_routine" || !made) return null;
  return (
    <View className="border-border my-3 gap-2 rounded-xl border p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-muted-foreground font-sans text-xs">Automation created</Text>
        <Pressable
          onPress={() => router.navigate("/automations")}
          className="flex-row items-center gap-0.5"
        >
          <Text className="text-muted-foreground font-sans text-xs">Open</Text>
          <ArrowUpRight size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Pressable>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="bg-muted size-8 items-center justify-center rounded-md">
          <ProjectIcon icon={null} size={20} />
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-foreground font-medium text-sm">
            {made.name}
          </Text>
          <Text numberOfLines={1} className="text-muted-foreground font-sans text-xs">
            {describeSchedule(made.schedule)}
          </Text>
        </View>
        {!made.enabled && <Text className="text-muted-foreground font-sans text-xs">Paused</Text>}
      </View>
    </View>
  );
};

export const BotEvent: FC<{ tool: string; output: unknown }> = ({ tool, output }) => {
  const name = currentToolName(tool);
  const skill = name === "update_skill" ? skillSaved.safeParse(output).data : undefined;
  if (skill) {
    return (
      <EventLine
        Icon={Sparkles}
        label={skill.action === "write" ? "Saved skill" : "Deleted skill"}
        name={skill.name}
        href={skill.action === "write" ? "/plugins" : undefined}
      />
    );
  }
  if (name === "update_memory" && memorySaved.safeParse(output).success) {
    return <EventLine Icon={Brain} label="Memory updated" subtle />;
  }
  return null;
};
