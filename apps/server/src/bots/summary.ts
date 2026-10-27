import { type LanguageModel, Output, streamText } from "ai";
import { z } from "zod";
import type { ProviderOptions } from "../models/subscription";
import { reasonOf } from "../http";
import { readSummary, writeSummary } from "../chat/sessions";
import type { ChatMessage } from "../shared/messages";
import { BOT_HISTORY, type BotScope, recentTurns } from "./tools";
import { textOf } from "./chatSearch";

const SUMMARY_TIMEOUT_MS = 20_000;
const FIELD_ASKED = 250;
const FIELD_CHARS = 300;
const MESSAGE_CHARS = 800;

const FIELDS = [
  ["goal", "Goal"],
  ["preferences", "Preferences"],
  ["decisions", "Decisions"],
  ["progress", "Progress"],
  ["openQuestions", "Open questions"],
] as const;

const summaryFields = z.object({
  goal: z.string(),
  preferences: z.string(),
  decisions: z.string(),
  progress: z.string(),
  openQuestions: z.string(),
});

const SUMMARY_PROMPT = `You keep a short running summary of a long chat between a user and their bot in Sirathic, an Islamic answering app. Older turns drop out of the bot's view, so this summary is all it keeps of them.

You get the current summary, if any, and the newest turns that are about to drop out. Write the updated summary, keeping what still matters from the current one and adding what is new. Fill these fields, each under ${FIELD_ASKED} characters, plain sentences or short lines, "none" when empty:
- goal: what the user is trying to achieve with this bot.
- preferences: how they like to be taught or answered, their level, language, schedule and the facts about them that matter.
- decisions: what was agreed or chosen, such as a plan, a routine or a topic order.
- progress: what has been covered so far, by topic, and what is next.
- openQuestions: what the user asked that is still unanswered or undecided.

Record what was discussed and decided. Never write a verse, a hadith or a ruling as a fact and never quote one: say that the hadith about intentions was taught, not what it says. Drop small talk.`;

export const fallenOut = <Message extends { role: string }>(
  messages: Message[],
  covered: number,
) => {
  const upTo = messages.length - recentTurns(messages, BOT_HISTORY).length;
  return { fresh: messages.slice(covered, upTo), upTo };
};

const render = (fields: z.output<typeof summaryFields>) =>
  FIELDS.map(([key, label]) => `${label}: ${fields[key].trim().slice(0, FIELD_CHARS)}`).join("\n");

const transcript = (messages: ChatMessage[]) =>
  messages
    .map(
      (message) =>
        `${message.role === "user" ? "USER" : "BOT"}:\n${textOf(message).slice(0, MESSAGE_CHARS)}`,
    )
    .join("\n\n");

type Refresh = {
  bot: BotScope;
  messages: ChatMessage[];
  model: LanguageModel;
  providerOptions: ProviderOptions;
};

async function addToSummary({ bot, messages, model, providerOptions }: Refresh) {
  const stored = await readSummary(bot.id, bot.owner);
  if (!stored) return;
  const { fresh, upTo } = fallenOut(messages, stored.summarized);
  if (fresh.length === 0) return;
  const written = await streamText({
    model,
    instructions: SUMMARY_PROMPT,
    prompt: `CURRENT SUMMARY:\n${stored.summary ?? "none yet"}\n\nTURNS TO ADD:\n${transcript(fresh)}`,
    output: Output.object({ schema: summaryFields }),
    providerOptions,
    abortSignal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
  }).output;
  await writeSummary(bot.id, bot.owner, render(written), upTo);
}

export const refreshSummary = (refresh: Refresh) =>
  addToSummary(refresh).catch((err: Error) => {
    console.error(`bot summary not updated: ${reasonOf(err)}`);
  });

export async function summaryNote(bot: BotScope): Promise<ChatMessage[]> {
  const stored = await readSummary(bot.id, bot.owner).catch((err: Error) => {
    console.error(`bot summary not read: ${reasonOf(err)}`);
    return undefined;
  });
  if (!stored?.summary) return [];
  return [
    {
      id: "summary",
      role: "system",
      parts: [
        {
          type: "text",
          text: `Notes on the earlier part of this chat, which has dropped out of view. They record what was discussed and decided, not sources: never repeat a verse, hadith or ruling from them, look it up again.\n\n${stored.summary}`,
        },
      ],
    },
  ];
}
