import { useChat } from "@ai-sdk/react";
import { type ChatMessage, messageText } from "@sirathic/server/messages";
import { type ComponentRef, type FC, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useBots } from "@/lib/bots";
import { type Group } from "@/lib/groups";
import { ChatLink } from "./answer";
import { BotAvatar } from "./bot-avatar";
import { BotSays, BotYou, stampOf, Working } from "./bot-turns";
import { liveChat, messageOf, savedRoom } from "./chat";
import { Composer } from "./composer";
import { ComposerDock } from "./composer-dock";
import { MenuButton } from "./page";

const POLL_MS = 3_000;

const answerAfter = (messages: ChatMessage[], index: number) => {
  const next = messages.slice(index + 1).find((message) => message.role === "user");
  return next && messageText(next);
};

export const GroupChat: FC<{ group: Group; initialMessages: ChatMessage[] }> = ({
  group,
  initialMessages,
}) => {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const bots = useBots((s) => s.bots);
  const [session] = useState(() => liveChat(group.id, initialMessages, group.id));
  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({ chat: session });
  const [typing, setTyping] = useState(false);
  const busy = status === "submitted" || status === "streaming";
  const members = (group.members ?? []).flatMap((id) => bots?.find((bot) => bot.id === id) ?? []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (session.status === "submitted" || session.status === "streaming") return;
      void savedRoom(group.id).then(
        (saved) => {
          setTyping(saved.working);
          if (session.status === "ready" && saved.messages.length > session.messages.length) {
            session.messages = saved.messages;
          }
        },
        () => undefined,
      );
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [group.id, session]);

  return (
    <ChatLink value={`https://sirathic.com/group/${group.id}`}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="h-14 flex-row items-center gap-2 px-2">
          <MenuButton />
          <View className="bg-muted h-11 flex-row items-center gap-2 rounded-full px-3">
            <View className="flex-row">
              {members.slice(0, 3).map((bot, index) => (
                <View key={bot.id} className={index > 0 ? "-ms-2" : undefined}>
                  <BotAvatar color={bot.color} body={bot.symbol} seed={bot.id} size={26} />
                </View>
              ))}
            </View>
            <Text numberOfLines={1} className="text-foreground font-medium max-w-48 text-base">
              {group.name}
            </Text>
          </View>
        </View>
        <ScrollView
          ref={scroll}
          contentContainerClassName="px-4 pb-6"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) =>
            message.role === "user" ? (
              <BotYou
                key={message.id}
                message={message}
                reply={messages[index + 1]}
                stamp={stampOf(messages, index)}
                color="white"
              />
            ) : (
              <BotSays
                key={message.id}
                message={message}
                running={false}
                reply={answerAfter(messages, index)}
                feedback={message.metadata?.feedback ?? null}
                onRate={() => undefined}
                onAsk={(text) => void sendMessage({ text, metadata: {} })}
              />
            ),
          )}
          {typing && <Working step={undefined} />}
          {error && <Text className="text-destructive font-sans text-sm">{messageOf(error)}</Text>}
        </ScrollView>
        <ComposerDock>
          <Composer
            placeholder={`Message ${group.name}`}
            busy={busy}
            onSend={(text, files) => void sendMessage({ text, files, metadata: {} })}
            onStop={() => void stop()}
            bot
          />
        </ComposerDock>
      </KeyboardAvoidingView>
    </ChatLink>
  );
};
