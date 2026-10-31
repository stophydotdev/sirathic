"use client";

import { useT } from "@/components/i18n";
import { quiz as quizSchema, shuffledOptions } from "@sirathic/server/cards";
import { type FC, useState } from "react";
import type { z } from "zod";

type Question = z.infer<typeof quizSchema>["questions"][number];

const pill =
  "bg-foreground/8 hover:bg-foreground/12 h-8 rounded-full px-3 text-sm font-medium disabled:opacity-40";

const Asked: FC<{
  question: Question;
  picked: string | undefined;
  onPick: (option: string) => void;
}> = ({ question, picked, onPick }) => {
  const options = shuffledOptions(question);
  const [hinted, setHinted] = useState(false);
  const t = useT();
  const right = picked === question.answer;

  return (
    <>
      <p className="text-base leading-snug font-medium">{question.prompt}</p>
      <div className="border-foreground/10 divide-foreground/10 mt-3 flex flex-col divide-y overflow-hidden rounded-xl border">
        {options.map((option, index) => {
          const tone =
            picked === undefined
              ? "hover:bg-foreground/8"
              : option === question.answer
                ? "bg-emerald-500/15"
                : option === picked
                  ? "bg-red-500/15"
                  : "opacity-60";
          return (
            <button
              key={option}
              type="button"
              disabled={picked !== undefined}
              onClick={() => onPick(option)}
              className={`${tone} flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-start text-base leading-snug`}
            >
              <span className="bg-foreground/10 text-muted-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-md text-xs">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1">{option}</span>
            </button>
          );
        })}
      </div>
      {picked === undefined && question.hint && (
        <p className="text-muted-foreground mt-3 text-sm">
          {hinted ? (
            question.hint
          ) : (
            <button type="button" onClick={() => setHinted(true)} className="hover:text-foreground">
              {t("Show a hint")}
            </button>
          )}
        </p>
      )}
      {picked !== undefined && (
        <p className="mt-3 leading-relaxed">
          <strong>{right ? t("That's right.") : t("Not quite.")}</strong> {question.explanation}
        </p>
      )}
    </>
  );
};

const Flashcard: FC<{ question: Question }> = ({ question }) => {
  const [flipped, setFlipped] = useState(false);
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => setFlipped(!flipped)}
      aria-label={flipped ? t("Show the question") : t("Show the answer")}
      className="bg-background flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl p-5 text-center"
    >
      {flipped ? (
        <>
          <span className="text-base font-medium">{question.answer}</span>
          <span className="text-muted-foreground text-sm leading-relaxed">
            {question.explanation}
          </span>
        </>
      ) : (
        <>
          <span className="text-base leading-snug font-medium">{question.prompt}</span>
          <span className="text-muted-foreground text-sm">{t("Tap to see the answer")}</span>
        </>
      )}
    </button>
  );
};

export const QuizCard: FC<{ args: unknown }> = ({ args }) => {
  const shown = quizSchema.safeParse(args).data;
  const [flashcards, setFlashcards] = useState(shown?.mode === "flashcards");
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<Partial<Record<number, string>>>({});
  const [round, setRound] = useState(0);
  const t = useT();
  if (!shown) return null;
  const { questions } = shown;
  const question = questions[at];
  const finished = !flashcards && at === questions.length;
  const score = questions.filter((asked, index) => picks[index] === asked.answer).length;

  return (
    <div className="bg-foreground/7 my-4 rounded-3xl p-4 print:hidden">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 font-medium">{shown.title}</p>
        <div className="bg-foreground/8 flex shrink-0 rounded-full p-0.5 text-sm">
          {[false, true].map((cards) => (
            <button
              key={String(cards)}
              type="button"
              aria-pressed={flashcards === cards}
              onClick={() => {
                setFlashcards(cards);
                setAt(0);
              }}
              className={`${flashcards === cards ? "bg-background" : "text-muted-foreground"} h-7 rounded-full px-3`}
            >
              {cards ? t("Flashcards") : t("Quiz")}
            </button>
          ))}
        </div>
      </div>
      {finished ? (
        <div className="flex flex-col items-start gap-3">
          <p>{t("You got {score} of {count} right.", { score, count: questions.length })}</p>
          <button
            type="button"
            onClick={() => {
              setPicks({});
              setAt(0);
              setRound(round + 1);
            }}
            className={pill}
          >
            {t("Try again")}
          </button>
        </div>
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
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {t("{at} of {count}", { at: at + 1, count: questions.length })}
              </span>
              <div className="flex gap-2">
                {flashcards && (
                  <button
                    type="button"
                    disabled={at === 0}
                    onClick={() => setAt(at - 1)}
                    className={pill}
                  >
                    {t("Back")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={flashcards ? at === questions.length - 1 : picks[at] === undefined}
                  onClick={() => setAt(at + 1)}
                  className={pill}
                >
                  {!flashcards && at === questions.length - 1 ? t("See score") : t("Next")}
                </button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};
