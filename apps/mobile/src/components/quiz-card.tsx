import { quiz as quizSchema, shuffledOptions } from "@sirathic/server/cards";
import { type FC, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { z } from "zod";

type Question = z.infer<typeof quizSchema>["questions"][number];

const pill = "bg-foreground/8 active:bg-foreground/12 h-8 justify-center rounded-full px-3";

const Pill: FC<{ label: string; disabled?: boolean; onPress: () => void }> = ({
  label,
  disabled = false,
  onPress,
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    className={`${pill} ${disabled ? "opacity-40" : ""}`}
  >
    <Text className="text-foreground font-sans text-sm font-medium">{label}</Text>
  </Pressable>
);

const Asked: FC<{
  question: Question;
  picked: string | undefined;
  onPick: (option: string) => void;
}> = ({ question, picked, onPick }) => {
  const [hinted, setHinted] = useState(false);
  return (
    <View>
      <Text className="text-foreground font-sans text-base leading-snug font-medium">
        {question.prompt}
      </Text>
      <View className="border-foreground/10 mt-3 overflow-hidden rounded-xl border">
        {shuffledOptions(question).map((option, index) => {
          const tone =
            picked === undefined
              ? "active:bg-foreground/8"
              : option === question.answer
                ? "bg-emerald-500/15"
                : option === picked
                  ? "bg-red-500/15"
                  : "opacity-60";
          return (
            <Pressable
              key={option}
              disabled={picked !== undefined}
              onPress={() => onPick(option)}
              className={`${tone} min-h-11 flex-row items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-foreground/10 border-t" : ""}`}
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
          );
        })}
      </View>
      {picked === undefined && question.hint !== undefined && (
        <Pressable onPress={() => setHinted(true)} disabled={hinted} className="mt-3">
          <Text className="text-muted-foreground font-sans text-sm">
            {hinted ? question.hint : "Show a hint"}
          </Text>
        </Pressable>
      )}
      {picked !== undefined && (
        <Text className="text-foreground font-sans mt-3 text-base leading-relaxed">
          <Text className="font-bold">
            {picked === question.answer ? "That's right." : "Not quite."}
          </Text>{" "}
          {question.explanation}
        </Text>
      )}
    </View>
  );
};

const Flashcard: FC<{ question: Question }> = ({ question }) => {
  const [flipped, setFlipped] = useState(false);
  return (
    <Pressable
      accessibilityLabel={flipped ? "Show the question" : "Show the answer"}
      onPress={() => setFlipped(!flipped)}
      className="bg-background min-h-40 items-center justify-center gap-2 rounded-2xl p-5"
    >
      <Text className="text-foreground font-sans text-center text-base font-medium">
        {flipped ? question.answer : question.prompt}
      </Text>
      <Text className="text-muted-foreground font-sans text-center text-sm leading-relaxed">
        {flipped ? question.explanation : "Tap to see the answer"}
      </Text>
    </Pressable>
  );
};

export const QuizCard: FC<{ input: unknown }> = ({ input }) => {
  const shown = quizSchema.safeParse(input).data;
  const [flashcards, setFlashcards] = useState(shown?.mode === "flashcards");
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<Partial<Record<number, string>>>({});
  const [round, setRound] = useState(0);
  if (!shown) return null;
  const { questions } = shown;
  const question = questions[at];
  const finished = !flashcards && at === questions.length;
  const score = questions.filter((asked, index) => picks[index] === asked.answer).length;

  return (
    <View className="bg-foreground/7 my-2 w-full rounded-3xl p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-foreground font-sans flex-1 text-base font-medium">
          {shown.title}
        </Text>
        <View className="bg-foreground/8 flex-row rounded-full p-0.5">
          {[false, true].map((cards) => (
            <Pressable
              key={String(cards)}
              accessibilityState={{ selected: flashcards === cards }}
              onPress={() => {
                setFlashcards(cards);
                setAt(0);
              }}
              className={`${flashcards === cards ? "bg-background" : ""} h-7 justify-center rounded-full px-3`}
            >
              <Text
                className={`${flashcards === cards ? "text-foreground" : "text-muted-foreground"} font-sans text-sm`}
              >
                {cards ? "Flashcards" : "Quiz"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {finished ? (
        <View className="items-start gap-3">
          <Text className="text-foreground font-sans text-base">
            {`You got ${score} of ${questions.length} right.`}
          </Text>
          <Pill
            label="Try again"
            onPress={() => {
              setPicks({});
              setAt(0);
              setRound(round + 1);
            }}
          />
        </View>
      ) : (
        question && (
          <>
            {flashcards ? (
              <Flashcard key={at} question={question} />
            ) : (
              <Asked
                key={`${round}-${at}`}
                question={question}
                picked={picks[at]}
                onPick={(option) => setPicks({ ...picks, [at]: option })}
              />
            )}
            <View className="mt-4 flex-row items-center justify-between gap-2">
              <Text className="text-muted-foreground font-sans text-sm">{`${at + 1} of ${questions.length}`}</Text>
              <View className="flex-row gap-2">
                {flashcards && (
                  <Pill label="Back" disabled={at === 0} onPress={() => setAt(at - 1)} />
                )}
                <Pill
                  label={!flashcards && at === questions.length - 1 ? "See score" : "Next"}
                  disabled={flashcards ? at === questions.length - 1 : picks[at] === undefined}
                  onPress={() => setAt(at + 1)}
                />
              </View>
            </View>
          </>
        )
      )}
    </View>
  );
};
