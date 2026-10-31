import { type LanguageModel, Output, streamText, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { sideOptions } from "../models/subscription";
import type { ChatMessage } from "../shared/messages";
import { withoutEmDashes } from "./compact";
import { relatedQuestions } from "./related";

const QUESTION_CHARS = 1_500;
const ANSWER_CHARS = 6_000;
const RATIONALE_CHARS = 200;
const WAIT_MS = 5_000;
const CHECK_PROMPT = `You check one answer from Sirathic, an Islamic answering engine, and return two things.

memory: true only if the answer visibly states a specific fact from USER FACTS beyond what the user's own message says, like their madhhab or where they live, or materially relies on one for a concrete referent, continuation, recommendation or specificity. The fact must directly support the detail; same-topic overlap is not enough. False for names or direct address, greetings, generic warmth or offers, and style or formatting alone. If uncertain, false.

research: Research mode thinks longer, searches many more sources step by step, cross-references them and writes a fuller, sourced answer. Offer it only when the question would genuinely benefit from a broad, many-source investigation this answer could not cover, like comparing all four schools across their main books, tracing a ruling through many contemporary fatwas, or a question that needs dozens of current sources. Then write one sentence of at most 15 words on what Research would add, describing the task shape and never quoting or paraphrasing the user's message. Otherwise null: for questions this answer covers directly or with a handful of quick searches, for anything about a particular private person, the user's own or a family member's specific medical condition, or anything near self-harm or disordered eating. If uncertain, null.`;

const checked = z.object({ memory: z.boolean(), research: z.string().nullable() });

const answerCheck = async (
  model: LanguageModel,
  asked: string,
  answer: string,
  facts: readonly string[],
  abortSignal: AbortSignal,
) =>
  await streamText({
    model,
    instructions: CHECK_PROMPT,
    prompt: `USER FACTS:\n${facts.map((fact) => `- ${fact}`).join("\n") || "none"}\n\nUSER:\n${asked.slice(0, QUESTION_CHARS)}\n\nANSWER:\n${answer.slice(0, ANSWER_CHARS)}`,
    output: Output.object({ schema: checked }),
    providerOptions: sideOptions,
    abortSignal: AbortSignal.any([abortSignal, AbortSignal.timeout(WAIT_MS)]),
  }).output;

export async function afterAnswer({
  writer,
  model,
  asked,
  answer,
  related,
  research,
  facts,
  abortSignal,
}: {
  writer: UIMessageStreamWriter<ChatMessage>;
  model: LanguageModel;
  asked: string;
  answer: string;
  related: boolean;
  research: boolean;
  facts: readonly string[];
  abortSignal: AbortSignal;
}) {
  const [questions, check] = await Promise.all([
    related ? relatedQuestions(model, asked, answer, abortSignal).catch(() => []) : [],
    research || facts.length > 0
      ? answerCheck(model, asked, answer, facts, abortSignal).catch(() => undefined)
      : undefined,
  ]);
  if (questions.length > 0) writer.write({ type: "data-related", data: { questions } });
  const rationale = research && check?.research && withoutEmDashes(check.research).trim();
  if (rationale) {
    writer.write({
      type: "data-research",
      data: { rationale: rationale.slice(0, RATIONALE_CHARS) },
    });
  }
  if (facts.length > 0 && check?.memory) {
    writer.write({ type: "message-metadata", messageMetadata: { memory: true } });
  }
}
