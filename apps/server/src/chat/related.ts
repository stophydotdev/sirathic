import { type LanguageModel, Output, streamText } from "ai";
import { z } from "zod";
import { sideOptions } from "../models/subscription";

const QUESTION_CHARS = 1_500;
const ANSWER_CHARS = 4_000;
const RELATED_LIMIT = 5;
const WAIT_MS = 5_000;
const CITATIONS = /\[\d+\](\([^)\s]*\))?/gu;
const RELATED_PROMPT = `Suggest the follow-up questions this user is most likely to ask next, after reading the answer.

Rules:
- 5 questions, each under 70 characters.
- Write them the way the user would ask them, in the language the user wrote in.
- Each one goes one step past the answer: a related ruling, a condition, an exception or the evidence. Never ask what the answer already covered.
- Keep the Islamic terms the user used, like wudu, Fajr or zakat.
- No numbering, quotes or labels.`;

const suggested = z.object({ questions: z.array(z.string()) });

export async function relatedQuestions(
  model: LanguageModel,
  question: string,
  answer: string,
  abortSignal: AbortSignal,
) {
  const output = await streamText({
    model,
    instructions: RELATED_PROMPT,
    prompt: `USER:\n${question.slice(0, QUESTION_CHARS)}\n\nANSWER:\n${answer.replaceAll(CITATIONS, "").slice(0, ANSWER_CHARS)}`,
    output: Output.object({ schema: suggested }),
    providerOptions: sideOptions,
    abortSignal: AbortSignal.any([abortSignal, AbortSignal.timeout(WAIT_MS)]),
  }).output;
  return output.questions
    .map((asked) => asked.trim())
    .filter(Boolean)
    .slice(0, RELATED_LIMIT);
}
