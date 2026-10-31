import { type TODO_STATUSES, todoList } from "@sirathic/server/cards";
import { createContext, type FC, useContext } from "react";
import { Text, View } from "react-native";
import { Check } from "./icons";

type Status = (typeof TODO_STATUSES)[number];

const RING = {
  pending: "border-foreground/30",
  in_progress: "border-foreground",
  completed: "bg-foreground border-transparent",
  cancelled: "border-foreground/15",
} satisfies Record<Status, string>;

const TEXT = {
  pending: "text-muted-foreground",
  in_progress: "text-foreground font-medium",
  completed: "text-muted-foreground",
  cancelled: "text-muted-foreground/70 line-through",
} satisfies Record<Status, string>;

export const LatestTodo = createContext<string | undefined>(undefined);

export const TodoCard: FC<{ callId: string; output: unknown }> = ({ callId, output }) => {
  const latest = useContext(LatestTodo);
  const shown = todoList.safeParse(output).data;
  if (!shown || latest !== callId) return null;
  const done = shown.todos.filter((item) => item.status === "completed").length;
  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <Text className="text-muted-foreground font-sans mb-3 text-sm">
        {done} of {shown.todos.length} done
      </Text>
      <View className="gap-2">
        {shown.todos.map((item) => (
          <View key={item.id} className="flex-row items-start gap-3">
            <View
              className={`mt-0.5 size-5 items-center justify-center rounded-full border ${RING[item.status]}`}
            >
              {item.status === "completed" && (
                <Check size={12} strokeWidth={2.5} colorClassName="accent-background" />
              )}
            </View>
            <Text className={`font-sans flex-1 text-base ${TEXT[item.status]}`}>
              {item.content}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};
