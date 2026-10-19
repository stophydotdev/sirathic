import type { Source } from "@sirathic/server/sources";
import * as WebBrowser from "expo-web-browser";
import type { FC } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { siteName } from "@/lib/sources";
import { colors } from "@/theme";

export const SourcesSheet: FC<{
  sources: Source[];
  open: boolean;
  onClose: () => void;
}> = ({ sources, open, onClose }) => (
  <Modal
    visible={open}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}
  >
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{`${sources.length} sources`}</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
      <FlatList
        data={sources}
        keyExtractor={(item) => item.url}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.row}
            onPress={() => WebBrowser.openBrowserAsync(item.url)}
          >
            <Text
              style={styles.site}
            >{`${index + 1}. ${siteName(item.url)}`}</Text>
            <Text style={styles.sourceTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.snippet} numberOfLines={3}>
              {item.snippet}
            </Text>
          </Pressable>
        )}
      />
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { color: colors.foreground, fontSize: 16, fontWeight: "600" },
  done: { color: colors.accent, fontSize: 16 },
  row: {
    padding: 16,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  site: { color: colors.muted, fontSize: 12 },
  sourceTitle: { color: colors.foreground, fontSize: 15, fontWeight: "500" },
  snippet: { color: colors.muted, fontSize: 13 },
});
