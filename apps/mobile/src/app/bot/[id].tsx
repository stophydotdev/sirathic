import type { ChatMessage } from "@sirathic/server/messages";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { BotChat } from "@/components/bot-chat";
import { BotSettings } from "@/components/bot-settings";
import { useBots } from "@/lib/bots";
import { savedChat } from "@/components/chat";

export default function BotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bots = useBots((s) => s.bots);
  const bot = bots?.find((found) => found.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>();

  useEffect(() => {
    if (bots === undefined) void useBots.getState().refresh();
    else if (!bot) router.replace("/");
  }, [bots, bot]);

  useEffect(() => {
    let current = true;
    setMessages(undefined);
    savedChat(id).then(
      (found) => {
        if (current) setMessages(found);
      },
      () => {
        if (current) setMessages([]);
      },
    );
    return () => {
      current = false;
    };
  }, [id]);

  return (
    <View className="bg-background pt-safe flex-1">
      {bot && messages ? (
        <>
          <BotChat key={id} bot={bot} initialMessages={messages} />
          <BotSettings bot={bot} />
        </>
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator colorClassName="accent-muted-foreground" />
        </View>
      )}
    </View>
  );
}
