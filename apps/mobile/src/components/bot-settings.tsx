import { blankDraft } from "@sirathic/app/automationDraft";
import { BODIES, bodyOf, pathOf } from "@sirathic/app/blob/shape";
import { BOT_BODIES, BOT_COLORS, containsLink, PROJECT_NAME_MAX } from "@sirathic/server/projects";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { withUniwind } from "uniwind";
import { api } from "@/lib/api";
import { type Bot, useBots } from "@/lib/bots";
import { pluginIcon } from "@/lib/sources";
import { AutomationEditor } from "./automation-editor";
import { BOT_TINTS, BotAvatar, tintOf } from "./bot-avatar";
import { useBotPanel } from "./bot-menu";
import { card, RoutineDetail, RoutineList, useRoutines } from "./bot-routines";
import { X } from "./icons";

const Glyph = withUniwind(Svg);

const INSTRUCTIONS_MAX = 4000;

const field =
  "bg-card border-border text-foreground font-sans w-full rounded-xl border px-3 text-sm";

const Field: FC<{
  label: ReactNode;
  value: string;
  placeholder: string;
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
  check?: (text: string) => string | undefined;
  onSave: (text: string) => void;
}> = ({ label, value, placeholder, maxLength, required, multiline, check, onSave }) => {
  const [text, setText] = useState(value);
  const error = check?.(text.trim());
  return (
    <View className="gap-1.5">
      <Text className="text-muted-foreground font-sans ps-1 text-sm">{label}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColorClassName="accent-muted-foreground"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        onBlur={() => {
          const next = text.trim();
          if (next === value || error || (required && next === "")) setText(value);
          else onSave(next);
        }}
        className={`${field} ${multiline ? "h-24 py-2" : "h-11"}`}
      />
      {error && <Text className="text-destructive font-sans ps-1 text-sm">{error}</Text>}
    </View>
  );
};

const Picker: FC<{ bot: Bot }> = ({ bot }) => {
  const change = useBots((s) => s.change);
  const active = tintOf(bot.color);
  const current = bodyOf(bot.symbol, bot.id);
  return (
    <View className="bg-card gap-3 rounded-xl p-3">
      <View accessibilityRole="radiogroup" className="flex-row justify-between">
        {BOT_COLORS.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: active === BOT_TINTS[name] }}
            onPress={() => void change(bot.id, { color: name })}
            className={`rounded-full border p-0.5 ${active === BOT_TINTS[name] ? "border-foreground" : "border-transparent"}`}
          >
            <Glyph width={16} height={16} viewBox="0 0 16 16" colorClassName={BOT_TINTS[name]}>
              <Circle cx={8} cy={8} r={8} fill="currentColor" />
            </Glyph>
          </Pressable>
        ))}
      </View>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap">
        {BOT_BODIES.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: BODIES[name] === current }}
            onPress={() => void change(bot.id, { symbol: name })}
            className={`aspect-square w-1/8 items-center justify-center rounded-lg ${BODIES[name] === current ? "bg-foreground/15" : "active:bg-muted"}`}
          >
            <Glyph width={20} height={20} viewBox="-115 -115 230 230" colorClassName={active}>
              <Path
                d={pathOf({ radii: BODIES[name], rot: 0, cx: 0, cy: 0 }, 100)}
                fill="currentColor"
              />
            </Glyph>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const Progress: FC<{ id: string }> = ({ id }) => {
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof api.study.progress.query>>>();
  useEffect(() => {
    void api.study.progress.query({ id }).then(setProgress, () => undefined);
  }, [id]);
  if (!progress || progress.memorized + progress.learning === 0) return null;
  return (
    <View className={card}>
      <Text className="text-foreground font-medium text-sm">Progress</Text>
      <Text className="text-muted-foreground font-sans text-xs">
        {`${progress.memorized} memorized · ${progress.learning} learning · ${progress.due} due today`}
      </Text>
    </View>
  );
};

type Plugin = Awaited<ReturnType<typeof api.connectors.list.query>>[number];

const Plugins: FC<{ bot: Bot }> = ({ bot }) => {
  const change = useBots((s) => s.change);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  useEffect(() => {
    void api.connectors.list.query().then(
      (found) => setPlugins(found.filter((plugin) => plugin.connected)),
      () => undefined,
    );
  }, []);
  if (plugins.length === 0) return null;
  const enabled = bot.plugins ?? plugins.map((plugin) => plugin.id);
  const toggle = (pluginId: string) =>
    void change(bot.id, {
      plugins: enabled.includes(pluginId)
        ? enabled.filter((kept) => kept !== pluginId)
        : [...enabled, pluginId],
    });
  return (
    <View className={card}>
      <Text className="text-foreground font-medium text-sm">Plugins</Text>
      <Text className="text-muted-foreground font-sans mb-1 text-xs">
        Plugins this bot can use.
      </Text>
      {plugins.map((plugin) => {
        const on = enabled.includes(plugin.id);
        return (
          <Pressable
            key={plugin.id}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            onPress={() => toggle(plugin.id)}
            className="active:bg-muted -mx-2 flex-row items-center gap-2.5 rounded-[10px] px-2 py-1.5"
          >
            <Image
              source={{ uri: pluginIcon(plugin.url) }}
              className="bg-muted size-4 rounded-full"
            />
            <Text numberOfLines={1} className="text-foreground font-sans flex-1 text-sm">
              {plugin.name}
            </Text>
            <View
              className={`h-5 w-9 flex-row items-center rounded-full p-0.5 ${on ? "bg-foreground justify-end" : "bg-foreground/15 justify-start"}`}
            >
              <View className="bg-background size-4 rounded-full" />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

export const BotSettings: FC<{ bot: Bot }> = ({ bot }) => {
  const open = useBotPanel((s) => s.open);
  const setOpen = useBotPanel((s) => s.setOpen);
  const change = useBots((s) => s.change);
  const { routines, refresh } = useRoutines(bot.id);
  const [routineId, setRoutineId] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const routine = routines?.find((found) => found.id === routineId);

  return (
    <Modal visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
      <View className="bg-background pt-safe pb-safe flex-1">
        <View className="h-14 flex-row items-center justify-between ps-5 pe-3">
          <Text className="text-foreground font-medium text-base">Settings</Text>
          <Pressable
            accessibilityLabel="Close"
            onPress={() => setOpen(false)}
            className="active:bg-muted size-8 items-center justify-center rounded-full"
          >
            <X size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          </Pressable>
        </View>
        <ScrollView contentContainerClassName="gap-4 px-5 pb-6" keyboardShouldPersistTaps="handled">
          {routine ? (
            <RoutineDetail
              routine={routine}
              onBack={() => setRoutineId(undefined)}
              onChanged={refresh}
            />
          ) : (
            <>
              <Pressable
                accessibilityLabel="Edit bot avatar"
                onPress={() => setPicking(!picking)}
                className="my-4 self-center rounded-full"
              >
                <BotAvatar
                  color={bot.color}
                  body={bot.symbol}
                  seed={bot.id}
                  state="opening"
                  size={80}
                />
              </Pressable>
              {picking && <Picker bot={bot} />}
              <Field
                key={`name:${bot.name}`}
                label="Name"
                value={bot.name}
                placeholder="Name"
                maxLength={PROJECT_NAME_MAX}
                required
                check={(text) =>
                  containsLink(text) ? "A project name cannot contain a link." : undefined
                }
                onSave={(name) => void change(bot.id, { name })}
              />
              <Field
                key={`title:${bot.title}`}
                label={
                  <>
                    {"Title "}
                    <Text className="opacity-70">Optional</Text>
                  </>
                }
                value={bot.title}
                placeholder="A short role, like Quranic Arabic tutor"
                maxLength={PROJECT_NAME_MAX}
                onSave={(title) => void change(bot.id, { title })}
              />
              <Field
                key={`instructions:${bot.instructions}`}
                label="Description"
                value={bot.instructions}
                placeholder="What should this bot do?"
                maxLength={INSTRUCTIONS_MAX}
                multiline
                onSave={(instructions) => void change(bot.id, { instructions })}
              />
              <Progress id={bot.id} />
              {routines && (
                <RoutineList
                  routines={routines}
                  onOpen={setRoutineId}
                  onCreate={() => setCreating(true)}
                />
              )}
              <Plugins bot={bot} />
            </>
          )}
        </ScrollView>
      </View>
      {creating && (
        <AutomationEditor
          automation={undefined}
          draft={blankDraft()}
          botId={bot.id}
          onClose={() => setCreating(false)}
          onSaved={() => void refresh()}
        />
      )}
    </Modal>
  );
};
