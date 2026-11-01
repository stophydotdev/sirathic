import { Chat as LiveChat, useChat } from "@ai-sdk/react";
import {
  type ChatMessage,
  chatData,
  messageMetadata,
  messageText,
} from "@sirathic/server/messages";
import { DefaultChatTransport, type FileUIPart, validateUIMessages } from "ai";
import { type ComponentRef, type FC, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share as SystemShare,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { z } from "zod";
import { api } from "@/lib/api";
import { API_URL, sessionHeaders } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { latestTodoId } from "@/lib/research";
import { Answer, type Feedback, PendingReply } from "./answer";
import { SentFiles } from "./attachment-chip";
import { Composer } from "./composer";
import { ComposerDock } from "./composer-dock";
import { GLASS, GlassFill } from "./glass";
import { Plus, Share, Spy } from "./icons";
import { Mark } from "./mark";
import { LatestTodo } from "./todo-card";

const transportIn = (projectId: string | undefined) =>
  new DefaultChatTransport<ChatMessage>({
    api: `${API_URL}/api/chat`,
    credentials: "omit",
    headers: sessionHeaders,
    body: () => {
      const { mode, model, effort, incognito } = useChatState.getState();
      return {
        mode: projectId ? "quick" : mode,
        model,
        effort,
        incognito,
        projectId,
        device: "phone",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  });

const live = new Map<string, LiveChat<ChatMessage>>();

const answering = (chat: LiveChat<ChatMessage>) =>
  chat.status === "submitted" || chat.status === "streaming";

const refreshSaved = () => {
  const { incognito, loadSessions } = useChatState.getState();
  if (!incognito) void loadSessions();
};

const markAnswered = (id: string) => {
  const { chatId, loadSessions } = useChatState.getState();
  void api.sessions.update
    .mutate({ id, unread: chatId !== id })
    .catch(() => undefined)
    .then(loadSessions);
};

export const liveChat = (id: string, messages: ChatMessage[] | undefined, projectId?: string) => {
  const found = live.get(id);
  if (found && answering(found)) return found;
  const created = new LiveChat<ChatMessage>({
    id,
    messages,
    transport: transportIn(projectId),
    onData: (part) => {
      if (part.type === "data-title") refreshSaved();
    },
    onFinish: () => (projectId ? refreshSaved() : markAnswered(id)),
  });
  const stopHere = created.stop;
  created.stop = async () => {
    void api.sessions.stop.mutate({ id }).catch(() => undefined);
    await stopHere();
  };
  live.set(id, created);
  return created;
};

export const savedRoom = (id: string) =>
  api.sessions.get.query({ id }).then(async ({ messages, answering: working }) => ({
    working,
    messages: await validateUIMessages<ChatMessage>({
      messages,
      dataSchemas: chatData,
      metadataSchema: messageMetadata,
    }),
  }));

export const savedChat = (id: string) => savedRoom(id).then(({ messages }) => messages);

const jsonText = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text);
  } catch {
    ctx.addIssue({ code: "custom", message: "not json" });
    return z.NEVER;
  }
});

const serverError = jsonText.pipe(z.object({ error: z.string() }));

export const messageOf = (error: Error) =>
  serverError.safeParse(error.message).data?.error ?? error.message;

const IncognitoToggle: FC = () => {
  const incognito = useChatState((s) => s.incognito);
  const setIncognito = useChatState((s) => s.setIncognito);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: incognito }}
      accessibilityLabel="Incognito"
      onPress={() => setIncognito(!incognito)}
      className={`h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-full px-2.5 ${incognito ? "bg-super/15" : "active:bg-muted"}`}
    >
      <GlassFill radius={22} />
      <Spy
        size={24}
        strokeWidth={1.75}
        colorClassName={incognito ? "accent-super" : "accent-muted-foreground"}
      />
      {incognito && <Text className="text-super font-sans text-sm">Incognito</Text>}
    </Pressable>
  );
};

export const SavedChat: FC<{ id: string }> = ({ id }) => {
  const [messages, setMessages] = useState<ChatMessage[]>();
  const [resumed] = useState(() => {
    const found = live.get(id);
    return found !== undefined && answering(found);
  });

  useEffect(() => {
    if (resumed) return;
    let current = true;
    savedChat(id).then(
      (found) => {
        if (current) setMessages(found);
      },
      () => {
        if (current) useChatState.getState().newChat();
      },
    );
    return () => {
      current = false;
    };
  }, [id, resumed]);

  return messages || resumed ? (
    <Chat id={id} initialMessages={messages} />
  ) : (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator colorClassName="accent-muted-foreground" />
    </View>
  );
};

export const Chat: FC<{ id: string; initialMessages?: ChatMessage[] }> = ({
  id,
  initialMessages,
}) => {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const newChat = useChatState((s) => s.newChat);
  const [session] = useState(() => liveChat(id, initialMessages));
  const { messages, sendMessage, regenerate, setMessages, status, stop, error } =
    useChat<ChatMessage>({ chat: session, resume: session.messages.length > 0 });
  const incognito = useChatState((s) => s.incognito);
  const [dock, setDock] = useState(0);
  const wasBusy = useRef(false);
  const busy = status === "submitted" || status === "streaming";
  const streaming = status === "streaming";
  useEffect(() => {
    if (streaming) refreshSaved();
  }, [streaming]);
  useEffect(() => {
    if (wasBusy.current && !busy) scroll.current?.scrollToEnd({ animated: true });
    wasBusy.current = busy;
  }, [busy]);
  const ask = (text: string, files: FileUIPart[] = []) =>
    void sendMessage({ text, files, metadata: {} });
  const rate = (messageId: string, next: Feedback) => {
    setMessages((all) =>
      all.map((message) =>
        message.id === messageId
          ? { ...message, metadata: { ...message.metadata, feedback: next ?? undefined } }
          : message,
      ),
    );
    if (!incognito) {
      void api.sessions.feedback.mutate({ id, messageId, value: next }).catch(() => undefined);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      {messages.length === 0 ? (
        <View className="flex-1">
          <View className="absolute end-3 top-0 h-14 justify-center">
            <IncognitoToggle />
          </View>
          <View className="my-auto items-center gap-5 pb-9">
            <Mark size={26} />
            <Text className="text-foreground font-sans px-4 text-center text-xl tracking-[-0.02em]">
              What do you want to know?
            </Text>
          </View>
          <ComposerDock>
            <Composer
              placeholder="Ask anything…"
              busy={busy}
              onSend={ask}
              onStop={() => void stop()}
            />
          </ComposerDock>
        </View>
      ) : (
        <View className="flex-1 justify-end">
          <ScrollView
            ref={scroll}
            className="absolute inset-0"
            contentContainerClassName="px-4 pt-14 pb-6"
            onContentSizeChange={() => {
              if (busy) scroll.current?.scrollToEnd({ animated: true });
            }}
          >
            <LatestTodo value={latestTodoId(messages)}>
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <View key={message.id} className="items-end pt-8 pb-6">
                    <SentFiles message={message} />
                    <Text className="bg-bubble text-foreground font-sans max-w-[90%] overflow-hidden rounded-3xl px-4 py-2.5 text-base">
                      {messageText(message)}
                    </Text>
                  </View>
                ) : (
                  <Answer
                    key={message.id}
                    chatId={id}
                    message={message}
                    streaming={busy && index === messages.length - 1}
                    feedback={message.metadata?.feedback ?? null}
                    onRate={(next) => rate(message.id, next)}
                    onRetry={() => void regenerate({ messageId: message.id })}
                    onResearch={
                      index === messages.length - 1
                        ? () => {
                            useChatState.getState().setMode("research");
                            void regenerate({ messageId: message.id });
                          }
                        : undefined
                    }
                    onAsk={ask}
                  />
                ),
              )}
            </LatestTodo>
            {busy && messages.at(-1)?.role === "user" && <PendingReply />}
            {error && (
              <Text className="text-destructive font-sans text-sm">{messageOf(error)}</Text>
            )}
            <View style={{ height: dock }} />
          </ScrollView>
          <View
            className={`absolute inset-x-0 top-0 h-14 flex-row items-center gap-2 ps-16 pe-3 ${GLASS ? "" : "bg-background"}`}
          >
            <Pressable
              accessibilityLabel="New chat"
              onPress={newChat}
              className="active:bg-muted size-11 items-center justify-center rounded-full"
            >
              <GlassFill radius={22} />
              <Plus size={24} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
            </Pressable>
            <View className="flex-1" />
            <IncognitoToggle />
            <Pressable
              accessibilityLabel="Share"
              disabled={incognito}
              onPress={() => void SystemShare.share({ message: `https://sirathic.com/c/${id}` })}
              className={`active:bg-foreground/15 size-11 items-center justify-center rounded-full disabled:opacity-40 ${GLASS ? "" : "bg-foreground/10"}`}
            >
              <GlassFill radius={22} />
              <Share size={22} strokeWidth={1.75} colorClassName="accent-foreground" />
            </Pressable>
          </View>
          <ComposerDock onLayout={(event) => setDock(event.nativeEvent.layout.height)}>
            <Composer
              placeholder="Ask a follow-up"
              busy={busy}
              onSend={ask}
              onStop={() => void stop()}
            />
          </ComposerDock>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};
