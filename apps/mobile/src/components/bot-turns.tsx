import { bubblesOf } from "@sirathic/app/botBubbles";
import { type ChatMessage, currentToolName } from "@sirathic/server/messages";
import type { Source } from "@sirathic/server/sources";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { type FC, Fragment, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useMarkdown } from "react-native-marked";
import { z } from "zod";
import { toolOf } from "@/lib/research";
import { siteName, sourcesOf, textOf, withoutCitations } from "@/lib/sources";
import { type Feedback, useMarkdownLook } from "./answer";
import { SentFiles } from "./attachment-chip";
import { AutomationCard, BotEvent, isBotEvent, isCardTool } from "./chat-cards";
import { Copy, Dots, ThumbDown, ThumbUp } from "./icons";
import { Menu, menuRow, menuText } from "./menu";
import { AskCard } from "./question-card";

type Tool = NonNullable<ReturnType<typeof toolOf>>;

type Said = { kind: "text"; text: string } | { kind: "tool"; tool: Tool };

const isMemoryWrite = (said: Said | undefined) =>
  said?.kind === "tool" && currentToolName(said.tool.name) === "update_memory";

const saidOf = (message: ChatMessage) =>
  message.parts
    .flatMap<Said>((part) => {
      if (part.type === "text") {
        return bubblesOf(withoutCitations(part.text)).map((text) => ({ kind: "text", text }));
      }
      const tool = toolOf(part);
      return tool &&
        (isCardTool(tool.name) ||
          isBotEvent(tool.name) ||
          currentToolName(tool.name) === "clarifying_questions")
        ? [{ kind: "tool", tool }]
        : [];
    })
    .filter((item, index, all) => !(isMemoryWrite(item) && isMemoryWrite(all[index - 1])));

const typingTime = (said: Said | undefined) =>
  said?.kind === "text" ? Math.min(500 + said.text.length * 12, 2000) : 300;

const usePaced = (said: Said[], ready: number, running: boolean) => {
  const [shown, setShown] = useState(running ? ready : Infinity);
  const shownAt = useRef(Date.now());
  const waiting = shown < ready;
  const wait = typingTime(said[shown]);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(
      () => {
        shownAt.current = Date.now();
        setShown((count) => count + 1);
      },
      Math.max(wait - (Date.now() - shownAt.current), 0),
    );
    return () => clearTimeout(timer);
  }, [shown, waiting, wait]);
  return shown;
};

const SEARCH_LINES = new Map([
  ["quran", "Searching the Quran…"],
  ["hadith", "Searching hadith…"],
  ["fatwa", "Searching fatwas…"],
  ["fiqh", "Reading the fiqh books…"],
  ["web", "Searching the web…"],
  ["news", "Searching the web…"],
]);

const TOOL_LINES = new Map([
  ["fetch_url", "Reading the page…"],
  ["get_verses", "Searching the Quran…"],
  ["code_execution", "Calculating…"],
  ["update_routine", "Setting it up…"],
  ["update_skill", "Setting it up…"],
  ["update_profile", "Setting it up…"],
  ["update_memory", "Setting it up…"],
  ["set_bot_job", "Setting it up…"],
  ["install_plugin", "Setting it up…"],
  ["stophy_search_endpoints", "Checking Stophy…"],
  ["stophy_call", "Checking Stophy…"],
]);

const searched = z.object({ sources: z.array(z.string()) });

const stepLineOf = (tool: Tool) =>
  currentToolName(tool.name) === "search_web"
    ? (searched.safeParse(tool.input).data?.sources ?? []).flatMap(
        (source) => SEARCH_LINES.get(source) ?? [],
      )[0]
    : currentToolName(tool.name).startsWith("browser_")
      ? "Reading the page…"
      : TOOL_LINES.get(currentToolName(tool.name));

const bubble = "bg-foreground/7 overflow-hidden rounded-3xl px-4 py-2";

const Dot: FC<{ delay: number }> = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [delay, opacity]);
  return (
    <Animated.View style={{ opacity }} className="bg-muted-foreground size-1.5 rounded-full" />
  );
};

const Working: FC<{ step: string | undefined }> = ({ step }) => (
  <View
    accessibilityRole="progressbar"
    accessibilityLabel="Typing…"
    className="mb-2 items-start gap-1"
  >
    <View className={bubble}>
      <View className="h-6 flex-row items-center gap-1">
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </View>
    </View>
    {step && <Text className="text-muted-foreground font-sans ms-1 text-xs">{step}</Text>}
  </View>
);

const BotText: FC<{ text: string }> = ({ text }) => {
  const look = useMarkdownLook();
  const elements = useMarkdown(text, {
    ...look,
    styles: { ...look.styles, paragraph: { marginBottom: 0, paddingVertical: 0 } },
  });
  return <View className={`${bubble} max-w-[90%]`}>{elements}</View>;
};

const MoreMenu: FC<{ text: string; feedback: Feedback; onRate: (next: Feedback) => void }> = ({
  text,
  feedback,
  onRate,
}) => (
  <Menu
    label="More actions"
    trigger={<Dots size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
    triggerClassName="active:bg-muted size-9 items-center justify-center rounded-md"
    contentClassName="w-48"
  >
    {(close) => (
      <>
        <Pressable
          onPress={() => {
            close();
            void Clipboard.setStringAsync(text);
          }}
          className={menuRow}
        >
          <Copy size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className={menuText}>Copy response</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            close();
            onRate(feedback === "up" ? null : "up");
          }}
          className={menuRow}
        >
          <ThumbUp size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className={`${menuText} flex-1`}>Helpful</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            close();
            onRate(feedback === "down" ? null : "down");
          }}
          className={menuRow}
        >
          <ThumbDown size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className={`${menuText} flex-1`}>Not helpful</Text>
        </Pressable>
      </>
    )}
  </Menu>
);

const SourceLine: FC<{ sources: readonly Source[] }> = ({ sources }) => {
  const sites = [...new Map(sources.map((source) => [siteName(source.url), source.url]))].slice(
    0,
    4,
  );
  if (sites.length === 0) return null;
  return (
    <Text className="text-muted-foreground font-sans mb-2 ms-4 max-w-[90%] text-xs">
      {"Sources: "}
      {sites.map(([name, url], index) => (
        <Fragment key={url}>
          {index > 0 && ", "}
          <Text onPress={() => void WebBrowser.openBrowserAsync(url)} className="text-super">
            {name}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
};

export const BotSays: FC<{
  message: ChatMessage;
  running: boolean;
  reply: string | undefined;
  feedback: Feedback;
  onRate: (next: Feedback) => void;
  onAsk: (text: string) => void;
}> = ({ message, running, reply, feedback, onRate, onAsk }) => {
  const said = saidOf(message);
  const last = message.parts.at(-1);
  const streaming = running && last?.type === "text" && last.text.trim() !== "";
  const shown = usePaced(said, said.length - (streaming ? 1 : 0), running);
  const asking = said.some(
    (item) =>
      item.kind === "tool" &&
      currentToolName(item.tool.name) === "clarifying_questions" &&
      reply === undefined,
  );
  const working = (running && !asking) || shown < said.length;
  const open = running
    ? message.parts.flatMap((part) => {
        const tool = toolOf(part);
        return tool && tool.output === undefined ? [tool] : [];
      })
    : [];
  const step = open.at(-1);
  const lastText = said.findLastIndex((item) => item.kind === "text");
  return (
    <View className="items-start pt-2">
      {said.slice(0, shown).map((item, index) => (
        <Fragment key={index}>
          {item.kind === "text" ? (
            <View className="mb-2 flex-row items-end gap-1">
              <BotText text={item.text} />
              {!working && index === lastText && (
                <MoreMenu text={textOf(message)} feedback={feedback} onRate={onRate} />
              )}
            </View>
          ) : currentToolName(item.tool.name) === "clarifying_questions" ? (
            <AskCard input={item.tool.input} reply={reply} busy={running} onAnswer={onAsk} />
          ) : (
            <>
              <AutomationCard tool={item.tool.name} output={item.tool.output} />
              <BotEvent tool={item.tool.name} output={item.tool.output} />
            </>
          )}
          {!working && index === lastText && <SourceLine sources={sourcesOf(message)} />}
        </Fragment>
      ))}
      {working && <Working step={step && stepLineOf(step)} />}
    </View>
  );
};

const reacted = z.object({ emoji: z.string() });

const DAY = 86_400_000;
const STAMP_GAP = 30 * 60_000;

const dayStart = (at: number) => new Date(at).setHours(0, 0, 0, 0);

const stampText = (at: number) => {
  const days = Math.round((dayStart(Date.now()) - dayStart(at)) / DAY);
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(at);
  return `${day} ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at)}`;
};

const sentAt = (messages: readonly ChatMessage[], index: number) => {
  const reply = messages[index + 1];
  return reply?.role === "assistant" ? reply.metadata?.createdAt : undefined;
};

export const stampOf = (messages: readonly ChatMessage[], index: number) => {
  const at = sentAt(messages, index);
  if (at === undefined) return undefined;
  const before = messages.slice(0, index).findLastIndex((message) => message.role === "user");
  const previous = before === -1 ? undefined : sentAt(messages, before);
  return previous === undefined || at - previous > STAMP_GAP ? at : undefined;
};

export const BotYou: FC<{
  message: ChatMessage;
  reply: ChatMessage | undefined;
  stamp: number | undefined;
}> = ({ message, reply, stamp }) => {
  const reaction = reply?.parts.flatMap((part) => {
    const tool = toolOf(part);
    return tool && currentToolName(tool.name) === "react_to_message"
      ? (reacted.safeParse(tool.output).data?.emoji ?? [])
      : [];
  })[0];
  const routine = message.metadata?.routine;
  return (
    <>
      {stamp !== undefined && (
        <Text className="text-muted-foreground font-sans pt-8 text-center text-xs">
          {stampText(stamp)}
        </Text>
      )}
      {routine ? (
        <Text className="text-muted-foreground font-sans pt-6 pb-1 text-center text-xs">
          {`Routine · ${routine}`}
        </Text>
      ) : (
        <View className="items-end pt-4 pb-2">
          <SentFiles message={message} />
          <View className={`max-w-[80%] ${reaction ? "mb-3" : ""}`}>
            <Text className="bg-sky-700 font-sans overflow-hidden rounded-3xl px-4 py-2 text-base text-white">
              {textOf(message)}
            </Text>
            {reaction && (
              <Text className="bg-background border-border absolute end-2 -bottom-3 overflow-hidden rounded-full border px-1.5 py-0.5 text-sm">
                {reaction}
              </Text>
            )}
          </View>
        </View>
      )}
    </>
  );
};
