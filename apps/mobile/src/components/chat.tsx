import { useChat } from "@ai-sdk/react";
import type { ChatMessage } from "@sirathic/server/messages";
import { DefaultChatTransport } from "ai";
import { type ComponentRef, type FC, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { API_URL, sessionHeaders } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { textOf } from "@/lib/sources";
import { colors } from "@/theme";
import { Answer } from "./answer";
import { Composer } from "./composer";

const transport = new DefaultChatTransport<ChatMessage>({
  api: `${API_URL}/api/chat`,
  credentials: "omit",
  headers: sessionHeaders,
  body: () => {
    const { mode, model } = useChatState.getState();
    return { mode, model, device: "phone" };
  },
});

const jsonText = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text);
  } catch {
    ctx.addIssue({ code: "custom", message: "not json" });
    return z.NEVER;
  }
});

const serverError = jsonText.pipe(z.object({ error: z.string() }));

const messageOf = (error: Error) =>
  serverError.safeParse(error.message).data?.error ?? error.message;

export const Chat: FC<{ id: string }> = ({ id }) => {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const loadModels = useChatState((s) => s.loadModels);
  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({
    id,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => void sendMessage({ text });

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.headline}>What do you want to know?</Text>
        </View>
      ) : (
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) =>
            message.role === "user" ? (
              <Text key={message.id} style={styles.question}>
                {textOf(message)}
              </Text>
            ) : (
              <Answer
                key={message.id}
                message={message}
                streaming={busy && index === messages.length - 1}
                onAsk={ask}
              />
            ),
          )}
          {error && <Text style={styles.error}>{messageOf(error)}</Text>}
        </ScrollView>
      )}
      <View style={styles.composer}>
        <Composer busy={busy} onSend={ask} onStop={() => void stop()} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  headline: { color: colors.foreground, fontSize: 24, fontWeight: "500" },
  thread: { padding: 16, gap: 20 },
  question: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: colors.card,
    color: colors.foreground,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
  },
  error: { color: colors.danger, fontSize: 14 },
  composer: { padding: 12 },
});
