import { useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { SquarePen } from "lucide-react-native";
import { Pressable } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DrawerPanel } from "@/components/drawer-panel";
import { useChatState } from "@/lib/chat-state";
import { installPolyfills } from "@/polyfills";
import { colors } from "@/theme";

installPolyfills();

const NewChatButton = () => {
  const newChat = useChatState((s) => s.newChat);
  const router = useRouter();
  return (
    <Pressable
      hitSlop={12}
      style={{ marginRight: 16 }}
      onPress={() => {
        newChat();
        router.navigate("/");
      }}
    >
      <SquarePen size={20} color={colors.foreground} />
    </Pressable>
  );
};

export default function Layout() {
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style="light" />
      <Drawer
        drawerContent={(props) => <DrawerPanel {...props} />}
        screenOptions={{
          title: "sirathic",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerRight: () => <NewChatButton />,
          drawerStyle: { backgroundColor: colors.background },
          sceneStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}
