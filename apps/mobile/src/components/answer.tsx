import type { ChatMessage } from "@sirathic/server/messages";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { Copy, Library } from "lucide-react-native";
import { type FC, type ReactNode, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from "react-native";
import { Renderer, useMarkdown } from "react-native-marked";
import { z } from "zod";
import { relatedOf, siteName, sourcesOf, textOf } from "@/lib/sources";
import { colors } from "@/theme";
import { SourcesSheet } from "./sources-sheet";

const CITATION = /^\d+$/;

class AnswerRenderer extends Renderer {
  link(children: string | ReactNode[], href: string, styles?: TextStyle) {
    const label = z.string().safeParse(children).data ?? "";
    const open = () => WebBrowser.openBrowserAsync(href);
    return CITATION.test(label) ? (
      <Text key={this.getKey()} onPress={open} style={citationStyles.chip}>
        {` ${siteName(href)} `}
      </Text>
    ) : (
      <Text
        key={this.getKey()}
        onPress={open}
        style={[styles, citationStyles.link]}
      >
        {children}
      </Text>
    );
  }
}

const renderer = new AnswerRenderer();

const theme = {
  colors: {
    text: colors.foreground,
    link: colors.accent,
    code: colors.card,
    border: colors.border,
  },
};

const pendingLabel = (message: ChatMessage) =>
  message.parts.some((part) => part.type.startsWith("tool-"))
    ? "Reading sources…"
    : "Searching…";

export const Answer: FC<{
  message: ChatMessage;
  streaming: boolean;
  onAsk: (question: string) => void;
}> = ({ message, streaming, onAsk }) => {
  const text = textOf(message);
  const elements = useMarkdown(text, { renderer, theme, colorScheme: "dark" });
  const sources = useMemo(() => sourcesOf(message), [message]);
  const related = relatedOf(message);
  const [showSources, setShowSources] = useState(false);

  return (
    <View style={styles.answer}>
      {text ? (
        elements
      ) : (
        <Text style={styles.pending}>{pendingLabel(message)}</Text>
      )}
      {!streaming && text !== "" && (
        <View style={styles.actions}>
          {sources.length > 0 && (
            <Pressable
              style={styles.action}
              onPress={() => setShowSources(true)}
            >
              <Library size={15} color={colors.muted} />
              <Text
                style={styles.actionText}
              >{`${sources.length} sources`}</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.action}
            onPress={() => Clipboard.setStringAsync(text)}
          >
            <Copy size={15} color={colors.muted} />
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
        </View>
      )}
      {!streaming &&
        related.map((question) => (
          <Pressable
            key={question}
            style={styles.related}
            onPress={() => onAsk(question)}
          >
            <Text style={styles.relatedText}>{question}</Text>
          </Pressable>
        ))}
      <SourcesSheet
        sources={sources}
        open={showSources}
        onClose={() => setShowSources(false)}
      />
    </View>
  );
};

const citationStyles = StyleSheet.create({
  chip: {
    color: colors.muted,
    backgroundColor: colors.subtle,
    fontSize: 11,
    borderRadius: 6,
  },
  link: { color: colors.accent },
});

const styles = StyleSheet.create({
  answer: { gap: 4 },
  pending: { color: colors.muted, fontSize: 15 },
  actions: { flexDirection: "row", gap: 16, marginTop: 8 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { color: colors.muted, fontSize: 13 },
  related: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: 12,
  },
  relatedText: { color: colors.foreground, fontSize: 15 },
});
