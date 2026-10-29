import { useRouter } from "expo-router";
import { type FC, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "@/lib/api";
import { pluginIcon } from "@/lib/sources";
import { GLASS, GlassFill } from "./glass";
import { Plug, Sparkles } from "./icons";
import { MenuHeading, menuRow, menuText } from "./menu";

const TYPING_MENTION = /(?:^|\s)@([^@\n]*)$/u;

export const mentionQuery = (text: string) => TYPING_MENTION.exec(text)?.[1];

export const withMention = (text: string, name: string) =>
  text.replace(/@[^@\n]*$/u, () => `@${name} `);

type Mentionable =
  | { kind: "plugin"; key: string; name: string; url: string }
  | { kind: "skill"; key: string; name: string };

export const useMentionables = (wanted: boolean) => {
  const [items, setItems] = useState<Mentionable[]>();
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    void Promise.all([api.connectors.list.query(), api.skills.list.query()]).then(
      ([plugins, skills]) => {
        if (!current) return;
        setItems([
          ...plugins
            .filter((plugin) => plugin.connected)
            .map((plugin) => ({
              kind: "plugin" as const,
              key: plugin.id,
              name: plugin.name,
              url: plugin.url,
            })),
          ...skills.map((skill) => ({ kind: "skill" as const, key: skill.id, name: skill.name })),
        ]);
      },
      () => {
        if (current) setItems((kept) => kept ?? []);
      },
    );
    return () => {
      current = false;
    };
  }, [wanted]);
  return items;
};

export const MentionList: FC<{
  items: Mentionable[] | undefined;
  query: string;
  onChoose: (name: string) => void;
}> = ({ items, query, onChoose }) => {
  const router = useRouter();
  if (!items) return null;
  const found = items.filter((item) => item.name.toLowerCase().startsWith(query.toLowerCase()));
  if (found.length === 0 && (items.length > 0 || /\s/u.test(query))) return null;
  return (
    <View
      className={`border-foreground/10 mb-2 rounded-2xl border p-1.5 shadow-lg ${GLASS ? "" : "bg-card"}`}
    >
      <GlassFill radius={16} />
      {found.length === 0 ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/plugins")}
          className={menuRow}
        >
          <Plug size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className={menuText}>Add a plugin</Text>
        </Pressable>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" className="max-h-64">
          {found.map((item, index) => (
            <View key={item.key}>
              {item.kind !== found[index - 1]?.kind && (
                <MenuHeading>{item.kind === "plugin" ? "Plugins" : "Skills"}</MenuHeading>
              )}
              <Pressable
                accessibilityRole="menuitem"
                onPress={() => onChoose(item.name)}
                className={menuRow}
              >
                {item.kind === "plugin" ? (
                  <Image source={{ uri: pluginIcon(item.url) }} className="size-5 rounded" />
                ) : (
                  <Sparkles size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                )}
                <Text numberOfLines={1} className={`${menuText} flex-1`}>
                  {item.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};
