import { ANSWER_MAX, question } from "@sirathic/server/messages";
import { type FC, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { X } from "./icons";

export const QuestionCard: FC<{
  question: string;
  options: readonly string[];
  reply: string | undefined;
  busy: boolean;
  onAnswer: (text: string) => void;
}> = ({ question: asked, options, reply, busy, onAnswer }) => {
  const [dismissed, setDismissed] = useState(false);
  const [own, setOwn] = useState("");

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
    const text = own.trim();
    if (!text || busy) return;
    onAnswer(text);
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
          {options.map((option, index) => (
            <Pressable
              key={option}
              disabled={busy}
              onPress={() => onAnswer(option)}
              className={`active:bg-foreground/8 min-h-11 flex-row items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-foreground/10 border-t" : ""} ${busy ? "opacity-50" : ""}`}
            >
              <View className="bg-foreground/10 size-5 items-center justify-center rounded-md">
                <Text className="text-muted-foreground font-sans text-xs">
                  {String.fromCharCode(65 + index)}
                </Text>
              </View>
              <Text className="text-foreground font-sans flex-1 text-base leading-snug">
                {option}
              </Text>
            </Pressable>
          ))}
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
          {own.trim() !== "" && (
            <Pressable
              disabled={busy}
              onPress={submit}
              className="bg-foreground h-8 items-center justify-center rounded-full px-3"
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
  return asked ? (
    <QuestionCard question={asked.question} options={asked.options} {...rest} />
  ) : null;
};
