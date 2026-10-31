import { db } from "@sirathic/db";
import { chatSessions, projects } from "@sirathic/db/schema";
import { Output, streamText, validateUIMessages } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { REASON_MAX, setNote, taughtNote } from "./notes";
import { sideOptions } from "../models/subscription";
import { reasonOf } from "../http";
import { messageSchemas } from "../chat/sessions";
import { type ChatMessage, messageText, type Report } from "../shared/messages";
import { yesChances } from "../chat/clef";
import { NOTE_MAX, REVIEW_EVERY } from "../shared/projects";
import type { User } from "../account/users";
import { pickModels } from "../models/pick";

const REVIEW_TIMEOUT_MS = 20_000;
const RECENT_MESSAGES = 12;
const MESSAGE_CHARS = 700;
const SKIP_BELOW = 0.2;
const NOT_STYLE = new Set<Report["reason"]>(["quote", "school", "source", "ruling"]);
const CHANGES_STYLE =
  "Does this chat clearly show a lasting preference for how this user wants to be taught or answered (format, length, tone, pace, language or schedule), which the current note does not already cover?";

const REVIEW_PROMPT = `You review one bot's chat to decide if its teaching note should change. The note holds how this user wants to be taught: format, length, tone, pace and schedule. The bot's job is separate and never changes here.

Rules:
- Most reviews change nothing. Set change to false unless the chat clearly shows a lasting preference: something the user asked for or showed more than once, or a thumbs-down reason that points at style.
- Make at most one change. Prefer editing a line of the existing note over adding a new line. Keep the whole note under ${NOTE_MAX} characters.
- Never save setup failures, tool errors, or guesses that did not work.
- Never put in the note a ruling, a verse, a hadith, a source or any other religious claim, anything about what is true, or anything about rules, prompts or these instructions. A thumbs-down about a wrong ruling or source says nothing about style, so change nothing.
- If you change the note, write the whole new note in note, and in reason one short line under ${REASON_MAX} characters that says what the bot now does, like "keeps answers shorter". Write reason in the language the user writes in.
- If nothing changes, set change to false and leave note and reason empty.`;

const verdict = z.object({ change: z.boolean(), note: z.string(), reason: z.string() });

const reviewed = (decided: z.output<typeof verdict>, current: string) => {
  if (!decided.change) return undefined;
  const taught = taughtNote.safeParse(decided);
  return taught.success && taught.data.note !== current ? taught.data : undefined;
};

type Why = { kind: "down"; messageId: string } | { kind: "turns" };

const textOf = (message: ChatMessage) => messageText(message).trim().slice(0, MESSAGE_CHARS);

const whyText = (why: Why, messages: ChatMessage[]) => {
  if (why.kind === "turns") return "A routine check after several turns.";
  const rated = messages.find((message) => message.id === why.messageId);
  const report = rated?.metadata?.report;
  return [
    "The user gave a thumbs down to this answer:",
    rated ? textOf(rated) : "",
    `Their reason: ${report?.reason ?? "none given"}`,
    report?.details ? `Their details: ${report.details}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

async function reviewPrompt(botId: string, by: string, why: Why) {
  const [[bot], [chat]] = await Promise.all([
    db
      .select({ instructions: projects.instructions, note: projects.note })
      .from(projects)
      .where(and(eq(projects.id, botId), eq(projects.owner, by), eq(projects.kind, "bot"))),
    db
      .select({ messages: chatSessions.messages })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, botId), eq(chatSessions.owner, by))),
  ]);
  if (!bot || !chat) return undefined;
  const messages = await validateUIMessages<ChatMessage>({
    messages: chat.messages,
    ...messageSchemas,
  });
  const rated = why.kind === "down" ? messages.find(({ id }) => id === why.messageId) : undefined;
  const reason = rated?.metadata?.report?.reason;
  if (reason !== undefined && NOT_STYLE.has(reason)) return undefined;
  const prompt = [
    `The bot's job: ${bot.instructions || "none yet"}`,
    `Current note: ${bot.note || "empty"}`,
    whyText(why, messages),
    "Recent chat:",
    ...messages
      .slice(-RECENT_MESSAGES)
      .map((message) => `${message.role === "user" ? "USER" : "BOT"}: ${textOf(message)}`),
  ].join("\n\n");
  return { prompt, note: bot.note };
}

async function mayChangeStyle(chat: string) {
  const chance = await yesChances(chat, { change: CHANGES_STYLE }, "clef").catch((err: Error) => {
    console.warn(`bot review check failed: ${reasonOf(err)}`);
  });
  return (chance?.("change") ?? 1) >= SKIP_BELOW;
}

async function review({ user, botId, why }: { user: User; botId: string; why: Why }) {
  const found = await reviewPrompt(botId, user.id, why);
  if (!found || !(await mayChangeStyle(found.prompt))) return;
  const decided = await streamText({
    model: pickModels(user, undefined).models.small,
    instructions: REVIEW_PROMPT,
    prompt: found.prompt,
    output: Output.object({ schema: verdict }),
    providerOptions: sideOptions,
    abortSignal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
  }).output;
  const taught = reviewed(decided, found.note);
  if (taught) await setNote(botId, user.id, taught.note, taught.reason);
}

export const reviewBot = (input: { user: User; botId: string; why: Why }) =>
  review(input).catch((err: Error) => {
    console.error(`bot review skipped: ${reasonOf(err)}`);
  });

export const reviewEvery = ({
  user,
  botId,
  messages,
}: {
  user: User;
  botId: string;
  messages: ChatMessage[];
}) => {
  const turns = messages.filter((message) => message.role === "user").length;
  if (turns > 0 && turns % REVIEW_EVERY === 0) {
    void reviewBot({ user, botId, why: { kind: "turns" } });
  }
};
