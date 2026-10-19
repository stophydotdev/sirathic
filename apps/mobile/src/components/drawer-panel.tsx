import type { DrawerContentComponentProps } from "expo-router/drawer";
import { LogOut, SquarePen } from "lucide-react-native";
import type { FC } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { colors } from "@/theme";

export const DrawerPanel: FC<DrawerContentComponentProps> = ({
  navigation,
}) => {
  const { data } = authClient.useSession();
  const newChat = useChatState((s) => s.newChat);

  return (
    <SafeAreaView style={styles.panel}>
      <Text style={styles.brand}>sirathic</Text>
      <Pressable
        style={styles.row}
        onPress={() => {
          newChat();
          navigation.closeDrawer();
        }}
      >
        <SquarePen size={18} color={colors.foreground} />
        <Text style={styles.rowText}>New</Text>
      </Pressable>
      <View style={styles.spacer} />
      {data && (
        <View style={styles.account}>
          <Text style={styles.email} numberOfLines={1}>
            {data.user.email}
          </Text>
          <Pressable
            style={styles.row}
            onPress={() => void authClient.signOut()}
          >
            <LogOut size={18} color={colors.muted} />
            <Text style={styles.muted}>Sign out</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  brand: {
    color: colors.foreground,
    fontSize: 18,
    letterSpacing: 2,
    paddingVertical: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowText: { color: colors.foreground, fontSize: 16 },
  spacer: { flex: 1 },
  account: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  email: { color: colors.foreground, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 15 },
});
