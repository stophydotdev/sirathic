import { router } from "expo-router";
import { type FC, type ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { type Session, useChatState } from "@/lib/chat-state";
import { useGroups } from "@/lib/groups";
import { Plus, Search, Spy } from "./icons";
import { Dim, Pop } from "./motion";

type Command = { key: string; icon?: ReactNode; label: string; hint?: string; run: () => void };

const heading = "text-muted-foreground font-sans px-2 pb-1 text-xs";

const Option: FC<{ command: Command }> = ({ command }) => (
  <Pressable
    onPress={command.run}
    className={`active:bg-foreground/5 flex-row items-center gap-3 rounded-lg px-2 ${command.icon ? "min-h-9" : "min-h-10"}`}
  >
    {command.icon}
    <Text numberOfLines={1} className="text-foreground font-sans shrink text-base">
      {command.label}
    </Text>
    {command.hint && (
      <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-base">
        {command.hint}
      </Text>
    )}
  </Pressable>
);

export const SearchChats: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Session[]>([]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(
      () =>
        void api.sessions.list.query({ query: query.trim() }).then(
          (sessions) => {
            if (current) setFound(sessions);
          },
          () => undefined,
        ),
      150,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  const startChat = (incognito: boolean, draft = "") => {
    const { newChat, setIncognito, setDraft } = useChatState.getState();
    newChat();
    setIncognito(incognito);
    setDraft(draft);
    close();
    router.navigate("/");
  };

  const asked = query.trim();
  const commands: Command[] = [
    ...(asked
      ? [
          {
            key: "ask",
            icon: <Search size={20} strokeWidth={1.75} colorClassName="accent-foreground" />,
            label: "Ask Sirathic",
            hint: asked,
            run: () => startChat(false, asked),
          },
        ]
      : []),
    {
      key: "new",
      icon: <Plus size={20} strokeWidth={1.75} colorClassName="accent-foreground" />,
      label: "New chat",
      run: () => startChat(false),
    },
    {
      key: "incognito",
      icon: <Spy size={20} strokeWidth={1.75} colorClassName="accent-foreground" />,
      label: "New incognito chat",
      run: () => startChat(true),
    },
  ];
  const results: Command[] = found.map((session) => ({
    key: session.id,
    label: session.title,
    run: () => {
      close();
      if (session.projectId) {
        const room = useGroups.getState().groups?.some((group) => group.id === session.projectId);
        router.navigate({
          pathname: room ? "/group/[id]" : "/bot/[id]",
          params: { id: session.projectId },
        });
        return;
      }
      useChatState.getState().open(session.id);
      router.navigate("/");
    },
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close}>
      <Pressable onPress={close} className="pt-safe-offset-16 flex-1 px-4">
        <Dim />
        <Pop>
          <Pressable className="bg-background border-foreground/7 w-full rounded-2xl border shadow-lg">
            <View className="border-border/50 h-14 flex-row items-center gap-3 border-b px-5">
              <Search size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => commands[0]?.run()}
                placeholder="Type a command or search"
                placeholderTextColorClassName="accent-muted-foreground"
                className="text-foreground font-sans flex-1 text-base"
              />
            </View>
            <ScrollView
              className="max-h-96"
              contentContainerClassName="p-3"
              keyboardShouldPersistTaps="handled"
            >
              <Text className={heading}>Commands</Text>
              {commands.map((command) => (
                <Option key={command.key} command={command} />
              ))}
              <Text className={`${heading} pt-3`}>Results</Text>
              {results.length === 0 ? (
                <Text className="text-muted-foreground font-sans px-2 py-2 text-sm">
                  No chats found
                </Text>
              ) : (
                results.map((result) => <Option key={result.key} command={result} />)
              )}
            </ScrollView>
          </Pressable>
        </Pop>
      </Pressable>
    </Modal>
  );
};
