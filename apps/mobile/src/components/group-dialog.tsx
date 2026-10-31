import { botLabel } from "@sirathic/app/botGroups";
import { router } from "expo-router";
import { type FC, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useBots } from "@/lib/bots";
import { useGroups } from "@/lib/groups";
import { BotAvatar } from "./bot-avatar";
import { Check } from "./icons";
import { Dim, Pop } from "./motion";

export const openGroup = (id: string) =>
  router.navigate({ pathname: "/group/[id]", params: { id } });

export const GroupDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const bots = useBots((s) => s.bots) ?? [];
  const createGroup = useGroups((s) => s.createGroup);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const ready = name.trim() !== "" && picked.length >= 2 && !creating;

  const close = () => {
    setName("");
    setPicked([]);
    onClose();
  };

  const create = async () => {
    setCreating(true);
    const created = await createGroup({ name: name.trim(), members: picked });
    setCreating(false);
    if (!created) return;
    close();
    openGroup(created.id);
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close}>
      <Pressable onPress={close} className="pt-safe-offset-16 flex-1 px-4">
        <Dim />
        <Pop>
          <Pressable className="bg-card border-foreground/7 w-full rounded-2xl border shadow-lg">
            <TextInput
              autoFocus
              value={name}
              maxLength={50}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColorClassName="accent-muted-foreground"
              className="text-foreground font-sans h-12 px-4 text-base"
            />
            <ScrollView
              className="max-h-80"
              contentContainerClassName="p-2 pt-0"
              keyboardShouldPersistTaps="handled"
            >
              {bots.map((bot) => {
                const on = picked.includes(bot.id);
                return (
                  <Pressable
                    key={bot.id}
                    onPress={() =>
                      setPicked(on ? picked.filter((id) => id !== bot.id) : [...picked, bot.id])
                    }
                    className={`active:bg-foreground/8 h-11 flex-row items-center gap-3 rounded-xl px-2 ${on ? "bg-foreground/8" : ""}`}
                  >
                    <BotAvatar color={bot.color} body={bot.symbol} seed={bot.id} size={28} />
                    <Text numberOfLines={1} className="text-foreground font-sans flex-1 text-sm">
                      {botLabel(bot)}
                    </Text>
                    {on && (
                      <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="flex-row items-center justify-between gap-3 p-3 pt-1">
              <Text className="text-muted-foreground font-sans ps-2 text-xs">
                {picked.length < 2 ? "Pick at least two bots" : ""}
              </Text>
              <Pressable
                disabled={!ready}
                onPress={() => void create()}
                className={`bg-foreground h-9 justify-center rounded-lg px-3 ${ready ? "" : "opacity-40"}`}
              >
                <Text className="text-background font-medium text-sm">Create group</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pop>
      </Pressable>
    </Modal>
  );
};
