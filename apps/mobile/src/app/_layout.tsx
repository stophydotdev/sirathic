import "@/global.css";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Drawer } from "expo-router/drawer";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaListener } from "react-native-safe-area-context";
import { Uniwind, useResolveClassNames, useUniwind } from "uniwind";
import { ConfirmDialog } from "@/components/confirm";
import { OverlayHost } from "@/components/overlay";
import { DrawerPanel } from "@/components/drawer-panel";
import { usePreferences } from "@/lib/preferences";
import { installPolyfills } from "@/polyfills";

installPolyfills();
usePreferences.getState().load();

export default function Layout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const drawerStyle = useResolveClassNames("bg-sidebar w-3/4");
  const sceneStyle = useResolveClassNames("bg-background");
  const { theme } = useUniwind();
  if (!fontsLoaded) return null;

  return (
    <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
      <GestureHandlerRootView className="bg-background flex-1">
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
          <StatusBar style={theme === "light" ? "dark" : "light"} />
          <Drawer
            drawerContent={(props) => <DrawerPanel {...props} />}
            screenOptions={{ headerShown: false, drawerStyle, sceneStyle }}
          >
            <Drawer.Screen name="index" />
            <Drawer.Screen name="library" />
            <Drawer.Screen name="automations" />
            <Drawer.Screen name="tasks" />
            <Drawer.Screen name="plugins" />
            <Drawer.Screen name="settings" />
            <Drawer.Screen name="bot/[id]" />
            <Drawer.Screen name="group/[id]" />
          </Drawer>
          <ConfirmDialog />
          <OverlayHost />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
