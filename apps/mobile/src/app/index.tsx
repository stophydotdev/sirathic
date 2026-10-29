import { useNavigation } from "expo-router";
import type { DrawerNavigationProp } from "expo-router/drawer";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Chat, SavedChat } from "@/components/chat";
import { GLASS, GlassFill } from "@/components/glass";
import { Menu } from "@/components/icons";
import { SignInSheet } from "@/components/sign-in";
import { authClient } from "@/lib/auth";
import { useBots } from "@/lib/bots";
import { useChatState } from "@/lib/chat-state";

export default function Home() {
  const { data, isPending } = authClient.useSession();
  const [loaded, setLoaded] = useState(false);
  const userId = data?.user.id;
  const chatId = useChatState((s) => s.chatId);
  const saved = useChatState((s) => s.saved);
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();

  useEffect(() => {
    const { loadAccount, loadSessions } = useChatState.getState();
    void loadAccount();
    void loadSessions();
    void useBots.getState().refresh();
  }, [userId]);

  useEffect(() => {
    if (!isPending) setLoaded(true);
  }, [isPending]);

  return (
    <View className="bg-background pt-safe flex-1">
      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator colorClassName="accent-muted-foreground" />
        </View>
      ) : saved ? (
        <SavedChat key={chatId} id={chatId} />
      ) : (
        <Chat key={chatId} id={chatId} />
      )}
      <View className="top-safe absolute start-2 h-14 justify-center">
        <Pressable
          accessibilityLabel="Open menu"
          onPress={() => navigation.openDrawer()}
          className={`active:bg-muted size-11 items-center justify-center rounded-full ${GLASS ? "" : "bg-background/70"}`}
        >
          <GlassFill radius={22} />
          <Menu size={24} strokeWidth={1.75} colorClassName="accent-foreground" />
        </Pressable>
      </View>
      <SignInSheet />
    </View>
  );
}
