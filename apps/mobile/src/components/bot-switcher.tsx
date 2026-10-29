import { botLabel } from "@sirathic/app/botGroups";
import { router, useGlobalSearchParams } from "expo-router";
import { type FC, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { type Bot, useBots } from "@/lib/bots";
import { BotAvatar } from "./bot-avatar";
import { Check, Plus, Search } from "./icons";
import { Dim, Pop } from "./motion";

type Option = { kind: "create"; name: string } | { kind: "bot"; bot: Bot };

export const openBot = (id: string) => router.navigate({ pathname: "/bot/[id]", params: { id } });

export const BotSwitcher: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const bots = useBots((s) => s.bots) ?? [];
  const createBot = useBots((s) => s.createBot);
  const current = useGlobalSearchParams<{ id?: string }>().id;
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const typed = query.trim();
  const shown = bots.filter((bot) => botLabel(bot).toLowerCase().includes(typed.toLowerCase()));
  const options: Option[] = [
    { kind: "create", name: typed || "New bot" },
    ...shown.map((bot) => ({ kind: "bot" as const, bot })),
  ];

  const close = () => {
    setQuery("");
    onClose();
  };

  const choose = async (option: Option) => {
    if (creating) return;
    if (option.kind === "bot") {
      close();
      openBot(option.bot.id);
      return;
    }
    setCreating(true);
    const created = await createBot({ name: option.name, language: "en" });
    setCreating(false);
    if (!created) return;
    close();
    openBot(created.id);
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close}>
      <Pressable onPress={close} className="pt-safe-offset-16 flex-1 px-4">
        <Dim />
        <Pop>
          <Pressable className="bg-card border-foreground/7 w-full rounded-2xl border shadow-lg">
            <View className="h-12 flex-row items-center gap-3 px-4">
              <Search size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => {
                  const first = options[typed && shown.length > 0 ? 1 : 0];
                  if (first) void choose(first);
                }}
                placeholder="Search or create bots"
                placeholderTextColorClassName="accent-muted-foreground"
                className="text-foreground font-sans flex-1 text-base"
              />
            </View>
            <ScrollView
              className="max-h-80"
              contentContainerClassName="p-2 pt-0"
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => (
                <Pressable
                  key={option.kind === "create" ? "create" : option.bot.id}
                  disabled={creating}
                  onPress={() => void choose(option)}
                  className="active:bg-foreground/8 h-11 flex-row items-center gap-3 rounded-xl px-2"
                >
                  {option.kind === "create" ? (
                    <>
                      <View className="bg-foreground/10 size-7 items-center justify-center rounded-full">
                        <Plus size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                      </View>
                      <Text numberOfLines={1} className="text-foreground font-sans flex-1 text-sm">
                        {typed ? `Create “${typed}”` : "Create new bot"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <BotAvatar
                        color={option.bot.color}
                        body={option.bot.symbol}
                        seed={option.bot.id}
                        size={28}
                      />
                      <Text numberOfLines={1} className="text-foreground font-sans flex-1 text-sm">
                        {botLabel(option.bot)}
                      </Text>
                      {current === option.bot.id && (
                        <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                      )}
                    </>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pop>
      </Pressable>
    </Modal>
  );
};
