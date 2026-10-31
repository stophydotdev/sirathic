import { type ChatMessage, messageText } from "@sirathic/server/messages";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  type FC,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useResolveClassNames, useUniwind } from "uniwind";
import { Renderer, useMarkdown } from "react-native-marked";
import { z } from "zod";
import { type Now, nowOf, summaryOf, toolOf } from "@/lib/research";
import { citationRuns, faviconUrl, groupedCitations, relatedOf, sourcesOf } from "@/lib/sources";
import { usePreferences } from "@/lib/preferences";
import {
  Bulb,
  ChartBar,
  Check,
  ChevronRight,
  Copy,
  Refresh,
  Search,
  Sparkles,
  ThumbDown,
  ThumbUp,
  World,
} from "./icons";
import { Fold, Swap, Turn } from "./motion";
import { Cited, CitationPill, CitationSheet } from "./citation";
import { SourcesSheet } from "./sources-sheet";
import { AnswerCard, isAnswerCard, MemoryUsed, ResearchCard } from "./answer-cards";
import { AutomationCard, isCardTool } from "./chat-cards";
import { notesOf } from "@/lib/notes";
import { AnswerNote } from "./answer-note";

const CITATION = /^c\d+$/u;

class AnswerRenderer extends Renderer {
  link(children: string | ReactNode[], href: string) {
    const label = z.string().safeParse(children).data ?? "";
    const open = () => void WebBrowser.openBrowserAsync(href);
    if (!CITATION.test(label)) {
      return (
        <Text key={this.getKey()} onPress={open} className="text-super">
          {children}
        </Text>
      );
    }
    return <CitationPill key={this.getKey()} href={href} run={Number(label.slice(1))} />;
  }

  code(text: string, language?: string, containerStyle?: ViewStyle, textStyle?: TextStyle) {
    return language === "mermaid" ? (
      <ChartCard key={this.getKey()} />
    ) : (
      super.code(text, language, containerStyle, textStyle)
    );
  }
}

const ChatLink = createContext("https://sirathic.com");

const ChartCard: FC = () => {
  const href = useContext(ChatLink);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(href)}
      className="bg-card border-border active:bg-muted mb-4 flex-row items-center gap-2 rounded-xl border p-3"
    >
      <ChartBar size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
      <Text className="text-foreground font-sans flex-1 text-sm">Chart</Text>
      <Text className="text-muted-foreground font-sans text-sm">Open</Text>
      <ChevronRight size={16} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
    </Pressable>
  );
};

const renderer = new AnswerRenderer();

const SERIF = Platform.select({ ios: "Georgia", default: "serif" });
const SANS = Platform.select({ ios: "System", default: "sans-serif" });
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const stylesFor = (serif: boolean) => {
  const regular = { fontFamily: serif ? SERIF : SANS };
  const bold = { fontFamily: serif ? SERIF : SANS, fontWeight: "700" as const };
  const heading = {
    ...bold,
    fontSize: 22,
    lineHeight: 28,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 0,
    borderBottomWidth: 0,
  };
  return {
    text: { ...regular, fontSize: 17, lineHeight: 26 },
    paragraph: { marginBottom: 16, paddingVertical: 0 },
    codespan: {
      fontFamily: MONO,
      fontStyle: "normal" as const,
      fontWeight: "400" as const,
      fontSize: 15,
    },
    strong: bold,
    h1: heading,
    h2: heading,
    h3: heading,
    h4: { ...heading, fontSize: 18, lineHeight: 26, marginTop: 16, marginBottom: 4 },
    li: { ...regular, fontSize: 17, lineHeight: 26 },
  };
};

export const useMarkdownLook = () => {
  const serif = usePreferences((s) => s.answerFont === "serif");
  const { theme } = useUniwind();
  const text = useResolveClassNames("text-answer").color ?? "transparent";
  const link = useResolveClassNames("text-super").color ?? "transparent";
  const code = useResolveClassNames("text-card").color ?? "transparent";
  const border = useResolveClassNames("text-border").color ?? "transparent";
  return useMemo(
    () => ({
      theme: { colors: { text, link, code, border } },
      styles: stylesFor(serif),
      colorScheme: theme === "light" ? ("light" as const) : ("dark" as const),
    }),
    [serif, theme, text, link, code, border],
  );
};

const MarkdownPart: FC<{ text: string }> = ({ text }) => {
  const look = useMarkdownLook();
  return useMarkdown(text, { renderer, ...look });
};

const startTimes = new Map<string, number>();

const useSeconds = (id: string, running: boolean) => {
  const [started] = useState(() => {
    const at = startTimes.get(id) ?? Date.now();
    startTimes.set(id, at);
    return at;
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return Math.max(1, Math.round((now - started) / 1000));
};

const NowIcon: FC<{ now: Now }> = ({ now }) => {
  switch (now.kind) {
    case "search":
      return <Search size={20} strokeWidth={1.75} colorClassName="accent-foreground/70" />;
    case "read":
      return now.url ? (
        <Image source={{ uri: faviconUrl(now.url) }} className="size-4 rounded-full" />
      ) : (
        <World size={20} strokeWidth={1.75} colorClassName="accent-foreground/70" />
      );
    case "think":
      return <Bulb size={20} strokeWidth={1.75} colorClassName="accent-foreground/70" />;
    case "tool":
      return <Sparkles size={20} strokeWidth={1.75} colorClassName="accent-foreground/70" />;
    default: {
      const unknownKind: never = now.kind;
      return unknownKind;
    }
  }
};

const StatusLine: FC<{ message: ChatMessage; working: boolean }> = ({ message, working }) => {
  const seconds = useSeconds(message.id, working);
  const [open, setOpen] = useState(false);
  const steps = summaryOf(message);

  if (working) {
    const now = nowOf(message);
    return (
      <View className="mb-4 h-6 flex-row items-center gap-2">
        <NowIcon now={now} />
        <Text numberOfLines={1} className="text-muted-foreground font-sans shrink text-sm">
          {now.text}
        </Text>
        <Text className="text-muted-foreground/70 font-sans text-sm">{`${seconds}s`}</Text>
      </View>
    );
  }
  if (steps.length === 0) return null;
  return (
    <View className="mb-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="h-6 flex-row items-center gap-1 self-start"
      >
        <Text className="text-muted-foreground font-sans text-sm">Finished</Text>
        <Turn turned={open}>
          <ChevronRight size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Turn>
      </Pressable>
      <Fold open={open}>
        <View className="border-border ms-1.5 mt-1.5 gap-1.5 border-s ps-3">
          {steps.map((step) => (
            <Text key={step} className="text-muted-foreground font-sans text-sm leading-6">
              {step}
            </Text>
          ))}
        </View>
      </Fold>
    </View>
  );
};

const actionButton = "size-9 items-center justify-center rounded-full active:bg-muted";

export type Feedback = "up" | "down" | null;

export const Answer: FC<{
  chatId: string;
  message: ChatMessage;
  streaming: boolean;
  feedback: Feedback;
  onRate: (next: Feedback) => void;
  onRetry: () => void;
  onResearch?: () => void;
  onAsk: (question: string) => void;
}> = ({ chatId, message, streaming, feedback, onRate, onRetry, onResearch, onAsk }) => {
  const text = messageText(message);
  const parts = useMemo(() => notesOf(groupedCitations(text)), [text]);
  const sources = useMemo(() => sourcesOf(message), [message]);
  const related = relatedOf(message);
  const [showSources, setShowSources] = useState(false);
  const [cited, setCited] = useState<string[]>();
  const runs = useMemo(() => ({ runs: citationRuns(text), show: setCited }), [text]);
  const [copied, setCopied] = useState(false);
  const working = streaming && text === "";
  const cards = message.parts.flatMap((part, index) => {
    const tool = toolOf(part);
    if (!tool) return [];
    return isCardTool(tool.name)
      ? [<AutomationCard key={index} tool={tool.name} output={tool.output} />]
      : isAnswerCard(tool.name)
        ? [
            <AnswerCard
              key={index}
              name={tool.name}
              callId={tool.id}
              input={tool.input}
              output={tool.output}
            />,
          ]
        : [];
  });
  const research = message.parts.find((part) => part.type === "data-research");

  const copy = () => {
    void Clipboard.setStringAsync(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <View className="pb-4">
      <StatusLine message={message} working={working} />
      {cards}
      {text !== "" && (
        <Cited value={runs}>
          <ChatLink value={`https://sirathic.com/c/${chatId}`}>
            {parts.map((part, index) =>
              part.kind === "note" ? (
                <AnswerNote key={index} kind={part.note}>
                  <MarkdownPart text={part.text} />
                </AnswerNote>
              ) : (
                <MarkdownPart key={index} text={part.text} />
              ),
            )}
          </ChatLink>
        </Cited>
      )}
      {!streaming && text.trim() === "" && cards.length === 0 && (
        <View className="items-start gap-3">
          <Text className="text-muted-foreground font-sans text-sm">
            This answer stopped before it wrote anything.
          </Text>
          <Pressable
            onPress={onRetry}
            className="bg-muted active:bg-foreground/10 h-8 justify-center rounded-full px-3"
          >
            <Text className="text-foreground font-sans text-sm">Try again</Text>
          </Pressable>
        </View>
      )}
      {!streaming && research && onResearch && (
        <ResearchCard rationale={research.data.rationale} onResearch={onResearch} />
      )}
      {!streaming && message.metadata?.memory && <MemoryUsed />}
      {cited && (
        <CitationSheet urls={cited} sources={sources} onClose={() => setCited(undefined)} />
      )}
      {!streaming && text !== "" && (
        <View className="mt-3 flex-row items-center gap-0.5">
          <Pressable accessibilityLabel="Copy response" onPress={copy} className={actionButton}>
            <Swap
              swapped={copied}
              from={<Copy size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
              to={<Check size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Helpful"
            accessibilityState={{ selected: feedback === "up" }}
            onPress={() => onRate(feedback === "up" ? null : "up")}
            className={`${actionButton} ${feedback === "up" ? "bg-muted" : ""}`}
          >
            <ThumbUp
              size={18}
              strokeWidth={1.75}
              colorClassName={feedback === "up" ? "accent-foreground" : "accent-muted-foreground"}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Not helpful"
            accessibilityState={{ selected: feedback === "down" }}
            onPress={() => onRate(feedback === "down" ? null : "down")}
            className={`${actionButton} ${feedback === "down" ? "bg-muted" : ""}`}
          >
            <ThumbDown
              size={18}
              strokeWidth={1.75}
              colorClassName={feedback === "down" ? "accent-foreground" : "accent-muted-foreground"}
            />
          </Pressable>
          <Pressable accessibilityLabel="Retry response" onPress={onRetry} className={actionButton}>
            <Refresh size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          </Pressable>
          {sources.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowSources(true)}
              className="bg-muted active:bg-foreground/10 ms-1 h-[31px] flex-row items-center gap-1.5 rounded-full ps-1 pe-2.5"
            >
              <View className="flex-row">
                {sources.slice(0, 3).map((source, index) => (
                  <Image
                    key={source.url}
                    source={{ uri: faviconUrl(source.url) }}
                    className={`bg-background border-background size-6 rounded-full border-2 ${index > 0 ? "-ms-1.5" : ""}`}
                  />
                ))}
              </View>
              <Text className="text-foreground font-sans text-sm">
                {sources.length === 1 ? "1 source" : `${sources.length} sources`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {!streaming && related.length > 0 && (
        <View className="mt-6">
          <Text className="text-foreground font-medium mb-1 text-base">Related</Text>
          {related.map((question) => (
            <Pressable
              key={question}
              onPress={() => onAsk(question)}
              className="border-border/60 active:bg-muted flex-row items-center gap-3 border-t py-3"
            >
              <Text className="text-foreground/90 font-sans flex-1 text-sm">{question}</Text>
              <ChevronRight size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
            </Pressable>
          ))}
        </View>
      )}
      <SourcesSheet sources={sources} open={showSources} onClose={() => setShowSources(false)} />
    </View>
  );
};
