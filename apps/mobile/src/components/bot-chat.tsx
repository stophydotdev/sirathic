import { useChat } from "@ai-sdk/react";
import type { BlobState } from "@sirathic/app/blob/states";
import { type ChatMessage, currentToolName, messageText } from "@sirathic/server/messages";
import type { FileUIPart } from "ai";
import { REVIEW_EVERY } from "@sirathic/server/projects";
import { type ComponentRef, type FC, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { api } from "@/lib/api";
import { type Bot, useBots } from "@/lib/bots";
import { latestTodoId, toolOf } from "@/lib/research";
import type { Feedback } from "./answer";
import { BotAvatar } from "./bot-avatar";
import { BotMenu, useBotPanel } from "./bot-menu";
import { BotSays, BotYou, stampOf } from "./bot-turns";
import { LatestTodo } from "./todo-card";
import { liveChat, messageOf } from "./chat";
import { Composer } from "./composer";
import { ComposerDock } from "./composer-dock";
import { MenuButton } from "./page";
import { QuestionCard } from "./question-card";

const STARTER_REPLIES = [
  "Study the Quran with me, a few verses a day",
  "Teach me one hadith a day",
  "Teach me Quranic Arabic",
  "Coach me through Ramadan",
  "Tell my kids stories of the prophets",
  "Guide me as a new Muslim",
  "Answer my fiqh questions by my madhab",
] as const;

const LOOK_AFTER_MS = [4_000, 9_000, 16_000];

const answerAfter = (messages: ChatMessage[], index: number) => {
  const next = messages.slice(index + 1).find((message) => message.role === "user");
  return next && messageText(next);
};

const stateOf = (messages: ChatMessage[], status: string): BlobState => {
  const running = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  if (status === "error") return "failed";
  if (last?.role !== "assistant") return running ? "thinking" : "ready";
  const open = last.parts.flatMap((part) => {
    const tool = toolOf(part);
    return tool && tool.output === undefined ? [tool] : [];
  });
  if (open.some((tool) => currentToolName(tool.name) === "clarifying_questions")) return "asking";
  if (!running) return "ready";
  if (open.some((tool) => currentToolName(tool.name) === "search_web")) return "searching";
  if (open.length > 0) return "working";
  return last.parts.at(-1)?.type === "text" ? "writing" : "thinking";
};

const Learned: FC<{ bot: Bot; messages: ChatMessage[]; ready: boolean }> = ({
  bot,
  messages,
  ready,
}) => {
  const [learned, setLearned] = useState<Awaited<ReturnType<typeof api.notes.learned.query>>>(null);
  const downs = messages.filter((message) => message.metadata?.feedback === "down").length;
  const turns = messages.filter((message) => message.role === "user").length;
  const seenDowns = useRef(downs);

  const look = () =>
    api.notes.learned
      .query({ botId: bot.id })
      .then(setLearned)
      .catch(() => undefined);

  useEffect(() => {
    void look();
  }, [bot.id, bot.note]);

  useEffect(() => {
    if (!ready) setLearned(null);
  }, [ready]);

  useEffect(() => {
    const rated = downs > (seenDowns.current ?? 0);
    seenDowns.current = downs;
    if (!ready || !(rated || (turns > 0 && turns % REVIEW_EVERY === 0))) return;
    const timers = LOOK_AFTER_MS.map((ms) => setTimeout(() => void look(), ms));
    return () => timers.forEach(clearTimeout);
  }, [ready, downs, turns]);

  if (!learned) return null;
  const undo = async () => {
    setLearned(null);
    await api.notes.undo.mutate({ botId: bot.id, id: learned.id }).catch(() => undefined);
    await useBots.getState().refresh();
  };
  return (
    <View className="mt-1 mb-4 flex-row items-center gap-2">
      <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-xs">
        {`Learned: ${learned.reason}`}
      </Text>
      <Text
        onPress={() => void undo()}
        className="text-muted-foreground font-sans text-xs underline"
      >
        Undo
      </Text>
    </View>
  );
};

export const BotChat: FC<{ bot: Bot; initialMessages: ChatMessage[] }> = ({
  bot,
  initialMessages,
}) => {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [session] = useState(() => liveChat(bot.id, initialMessages, bot.id));
  const { messages, sendMessage, setMessages, status, stop, error } = useChat<ChatMessage>({
    chat: session,
  });
  const setPanel = useBotPanel((s) => s.setOpen);
  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string, files: FileUIPart[] = []) =>
    void sendMessage({ text, files, metadata: {} });
  const reply = answerAfter(messages, -1);

  const rate = (messageId: string, next: Feedback) => {
    setMessages((all) =>
      all.map((message) =>
        message.id === messageId
          ? { ...message, metadata: { ...message.metadata, feedback: next ?? undefined } }
          : message,
      ),
    );
    void api.sessions.feedback
      .mutate({ id: bot.id, messageId, value: next })
      .catch(() => undefined);
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="h-14 flex-row items-center justify-between gap-2 px-2">
        <View className="flex-1 flex-row items-center gap-2">
          <MenuButton />
          <Pressable
            accessibilityLabel="Settings"
            onPress={() => setPanel(true)}
            className="bg-muted active:bg-foreground/10 h-11 flex-row items-center gap-2 rounded-full px-3"
          >
            <BotAvatar
              color={bot.color}
              body={bot.symbol}
              seed={bot.id}
              state={stateOf(messages, status)}
              size={26}
            />
            <Text numberOfLines={1} className="text-foreground font-medium max-w-48 text-base">
              {bot.name}
            </Text>
          </Pressable>
        </View>
        <BotMenu
          bot={bot}
          triggerClassName="active:bg-muted size-11 items-center justify-center rounded-full"
          iconSize={24}
        />
      </View>
      <ScrollView
        ref={scroll}
        contentContainerClassName="px-4 pb-6"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: busy })}
      >
        <View className="items-start pt-8">
          <Text className="bg-foreground/7 text-foreground font-sans overflow-hidden rounded-3xl px-4 py-2 text-base">
            {bot.greeting ??
              "Assalamu alaikum. What do you want me around for? Anything concrete, or more of a study companion?"}
          </Text>
          {bot.options ? (
            <QuestionCard
              question={bot.question ?? "What should I focus on?"}
              options={bot.options}
              reply={reply}
              busy={busy}
              onAnswer={ask}
            />
          ) : (
            (!bot.instructions || reply !== undefined) && (
              <QuestionCard
                question="What should I focus on?"
                options={[...STARTER_REPLIES]}
                reply={reply}
                busy={busy}
                onAnswer={ask}
              />
            )
          )}
        </View>
        <LatestTodo value={latestTodoId(messages)}>
          {messages.map((message, index) =>
            message.role === "user" ? (
              <BotYou
                key={message.id}
                message={message}
                reply={messages[index + 1]}
                stamp={stampOf(messages, index)}
                color={bot.color}
              />
            ) : (
              <BotSays
                key={message.id}
                message={message}
                running={busy && index === messages.length - 1}
                reply={answerAfter(messages, index)}
                feedback={message.metadata?.feedback ?? null}
                onRate={(next) => rate(message.id, next)}
                onAsk={ask}
              />
            ),
          )}
        </LatestTodo>
        {error && <Text className="text-destructive font-sans text-sm">{messageOf(error)}</Text>}
        <Learned bot={bot} messages={messages} ready={status === "ready"} />
      </ScrollView>
      <ComposerDock>
        <Composer
          placeholder={`Message ${bot.name}`}
          busy={busy}
          onSend={ask}
          onStop={() => void stop()}
          bot
        />
      </ComposerDock>
    </KeyboardAvoidingView>
  );
};
