import { ANSWER_MAX, question } from "@sirathic/server/messages";
import { type FC, useState } from "react";
import type { z } from "zod";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, X } from "./icons";

export const QuestionCard: FC<
  z.infer<typeof question> & {
    reply: string | undefined;
    busy: boolean;
    onAnswer: (text: string) => void;
  }
> = ({ question: asked, options, multiple, reply, busy, onAnswer }) => {
  const [dismissed, setDismissed] = useState(false);
  const [own, setOwn] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const parts = [...options.filter((option) => picked.includes(option)), own.trim()].filter(
    (part) => part !== "",
  );
  const answer =
    parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

  if (dismissed || reply !== undefined) {
    return (
      <View className="my-2 items-start gap-1">
        <Text className="bg-foreground/7 text-foreground font-sans overflow-hidden rounded-3xl px-4 py-2 text-base">
          {asked}
        </Text>
        {dismissed && (
          <Text className="text-muted-foreground font-sans px-4 text-sm">Dismissed</Text>
        )}
      </View>
    );
  }

  const submit = () => {
    if (!answer || busy) return;
    onAnswer(answer);
    setOwn("");
  };

  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="text-foreground font-sans flex-1 text-base leading-snug">{asked}</Text>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setDismissed(true)}
          className="active:bg-foreground/8 -me-1 rounded-full p-1"
        >
          <X size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Pressable>
      </View>
      <View className="mt-3 gap-3">
        <View className="border-foreground/10 overflow-hidden rounded-xl border">
          {options.map((option, index) => {
            const checked = picked.includes(option);
            return (
              <Pressable
                key={option}
                disabled={busy}
                accessibilityRole={multiple ? "checkbox" : undefined}
                accessibilityState={multiple ? { checked } : undefined}
                onPress={() =>
                  multiple
                    ? setPicked(
                        checked ? picked.filter((pick) => pick !== option) : [...picked, option],
                      )
                    : onAnswer(option)
                }
                className={`active:bg-foreground/8 min-h-11 flex-row items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-foreground/10 border-t" : ""} ${busy ? "opacity-50" : ""}`}
              >
                <View
                  className={`${checked ? "bg-foreground" : "bg-foreground/10"} size-5 items-center justify-center rounded-md`}
                >
                  {checked ? (
                    <Check size={14} strokeWidth={2} colorClassName="accent-background" />
                  ) : (
                    <Text className="text-muted-foreground font-sans text-xs">
                      {String.fromCharCode(65 + index)}
                    </Text>
                  )}
                </View>
                <Text className="text-foreground font-sans flex-1 text-base leading-snug">
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="bg-background flex-row items-center gap-2 rounded-xl ps-4 pe-1.5">
          <TextInput
            value={own}
            onChangeText={setOwn}
            onSubmitEditing={submit}
            maxLength={ANSWER_MAX}
            placeholder="Type your own answer"
            placeholderTextColorClassName="accent-muted-foreground"
            className="text-foreground font-sans h-11 flex-1 text-base"
          />
          {(multiple || own.trim() !== "") && (
            <Pressable
              disabled={busy || !answer}
              onPress={submit}
              className={`bg-foreground h-8 items-center justify-center rounded-full px-3 ${answer ? "" : "opacity-50"}`}
            >
              <Text className="text-background font-medium text-sm">Submit</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

export const AskCard: FC<{
  input: unknown;
  reply: string | undefined;
  busy: boolean;
  onAnswer: (text: string) => void;
}> = ({ input, ...rest }) => {
  const asked = question.safeParse(input).data;
  return asked ? <QuestionCard {...asked} {...rest} /> : null;
};
