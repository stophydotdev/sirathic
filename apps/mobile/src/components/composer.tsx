import * as Haptics from "expo-haptics";
import { ArrowUp, ChevronDown, Square } from "lucide-react-native";
import { type FC, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useChatState } from "@/lib/chat-state";
import { colors } from "@/theme";

const chooseModel = () => {
  const { models, choose } = useChatState.getState();
  const names = models.map((model) => model.name);
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...names, "Cancel"], cancelButtonIndex: names.length },
      (index) => {
        const picked = models[index];
        if (picked) choose(picked.slug);
      },
    );
    return;
  }
  Alert.alert(
    "Model",
    undefined,
    models.map((model) => ({
      text: model.name,
      onPress: () => choose(model.slug),
    })),
    { cancelable: true },
  );
};

export const Composer: FC<{
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}> = ({ busy, onSend, onStop }) => {
  const [text, setText] = useState("");
  const mode = useChatState((s) => s.mode);
  const setMode = useChatState((s) => s.setMode);
  const modelName = useChatState((s) => s.models.find((model) => model.slug === s.model)?.name);
  const ready = text.trim() !== "";

  const send = () => {
    if (!ready) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim());
    setText("");
  };

  return (
    <View style={styles.box}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ask anything…"
        placeholderTextColor={colors.muted}
        multiline
      />
      <View style={styles.row}>
        <Pressable
          style={styles.pill}
          onPress={() => setMode(mode === "quick" ? "research" : "quick")}
        >
          <Text style={styles.pillText}>{mode === "quick" ? "Quick" : "Research"}</Text>
        </Pressable>
        <View style={styles.spacer} />
        {modelName && (
          <Pressable style={styles.pill} onPress={chooseModel}>
            <Text style={styles.pillText}>{modelName}</Text>
            <ChevronDown size={14} color={colors.muted} />
          </Pressable>
        )}
        <Pressable
          style={[styles.send, !busy && !ready && styles.sendIdle]}
          onPress={busy ? onStop : send}
        >
          {busy ? (
            <Square size={14} color={colors.background} fill={colors.background} />
          ) : (
            <ArrowUp size={18} color={colors.background} />
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  input: {
    color: colors.foreground,
    fontSize: 16,
    minHeight: 24,
    maxHeight: 140,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  spacer: { flex: 1 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
  },
  pillText: { color: colors.foreground, fontSize: 13 },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIdle: { opacity: 0.35 },
});
