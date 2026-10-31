import type { ChatMessage } from "@sirathic/server/messages";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { savedChat } from "@/components/chat";
import { GroupChat } from "@/components/group-chat";
import { useGroups } from "@/lib/groups";

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groups = useGroups((s) => s.groups);
  const group = groups?.find((found) => found.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>();

  useEffect(() => {
    if (groups === undefined) void useGroups.getState().refresh();
    else if (!group) router.replace("/");
  }, [groups, group]);

  useEffect(() => {
    let current = true;
    setMessages(undefined);
    savedChat(id).then(
      (found) => {
        if (current) setMessages(found);
      },
      () => {
        if (current) setMessages([]);
      },
    );
    return () => {
      current = false;
    };
  }, [id]);

  return (
    <View className="bg-background pt-safe flex-1">
      {group && messages ? (
        <GroupChat key={id} group={group} initialMessages={messages} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator colorClassName="accent-muted-foreground" />
        </View>
      )}
    </View>
  );
}
