import { type LanguageModel, Output, streamText } from "ai";
import { z } from "zod";
import type { ProviderOptions } from "../models/subscription";
import { type ChatMessage, messageText } from "../shared/messages";

const ASKED_LIMIT = 6;
const MESSAGE_CHARS = 1_500;
const TITLE_CHARS = 60;
const LINKS = /\[\d+\]\([^)\s]*\)/gu;
const TITLE_PROMPT = `Write a title that will help the user recognize this chat in their history weeks later.

Before answering, silently reduce the user's messages to:
- Subject: what topic, ruling, practice, verse or text is this really about?
- Outcome: what does the user want to know or do?

Title the subject and outcome.

Rules:
- 3 to 7 words, fewer than 40 characters.
- A compact noun phrase or a clear question phrase, in the language the user wrote in.
- Sentence case: capitalize only the first word and proper nouns.
- Do not copy and truncate the user's message.
- Keep the Islamic terms the user used, like wudu, Fajr or zakat.
- No quotes, labels, emojis or trailing punctuation.

Set needsRefinement to true only when the subject is still unknown, such as a greeting, thanks or small talk with no question yet. Otherwise set it to false.`;

const titled = z.object({ title: z.string(), needsRefinement: z.boolean() });

const textOf = (message: ChatMessage) => messageText(message).replaceAll(LINKS, "").trim();

const tidy = (raw: string) =>
  (raw.trim().split(/\r?\n/u)[0] ?? "")
    .replaceAll(/^["'`]+|["'`.!?:;,]+$/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, TITLE_CHARS)
    .trim();

export async function chatTitle(
  model: LanguageModel,
  messages: ChatMessage[],
  providerOptions: ProviderOptions,
) {
  const asked = messages
    .filter((message) => message.role === "user")
    .map(textOf)
    .filter(Boolean)
    .slice(-ASKED_LIMIT);
  if (asked.length === 0) return undefined;
  const output = await streamText({
    model,
    instructions: TITLE_PROMPT,
    prompt: asked.map((text) => `USER:\n${text.slice(0, MESSAGE_CHARS)}`).join("\n\n"),
    output: Output.object({ schema: titled }),
    providerOptions,
  }).output;
  if (output.needsRefinement) return undefined;
  return tidy(output.title) || undefined;
}
