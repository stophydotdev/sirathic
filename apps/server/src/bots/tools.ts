import { tool } from "ai";
import { z } from "zod";
import { profileRejection, profileWrite } from "./profile";
import {
  addProfileEntry,
  botTitle,
  projectInstructions,
  projectName,
  updateProject,
} from "../projects/projects";
import { question } from "../shared/messages";

export type BotScope = { id: string; owner: string };

export const BOT_HISTORY = 24;

export const recentTurns = <Message extends { role: string }>(
  messages: Message[],
  limit: number,
) => {
  const recent = messages.slice(-limit);
  const firstAsked = recent.findIndex((message) => message.role === "user");
  return firstAsked > 0 ? recent.slice(firstAsked) : recent;
};

export function botTools({ id, owner }: BotScope) {
  return {
    setBotJob: tool({
      description:
        "Sets this bot's name, title and job. Call it when the bot has no job yet and the user says what they want from it, or when the user asks to change them. The name is one to three words, like Ramadan Coach or Arabic Tutor. The title is a short role, like Quranic Arabic tutor. The job is a few sentences in the user's words that tell the bot what to do in every reply. The user sees a line saying the bot was renamed, so don't repeat it.",
      inputSchema: z.object({
        name: projectName,
        title: botTitle,
        job: projectInstructions.min(1),
      }),
      execute: async ({ name, title, job }) => {
        const bot = await updateProject(id, owner, { name, title, instructions: job });
        return { name: bot.name };
      },
    }),
    learnAboutUser: tool({
      description:
        "Saves one fact about this learner in your profile of them, which you see on every turn. Use it for their goal, level, madhab, language, pace, best time of day, current position (like 'memorized 112 to 114, now on 111'), what they like and what they dislike. Save the answer to every setup question you ask. Mark it said when they stated it and guessed when you inferred it from how they act. When it changes a saved entry on the same topic, set replaces to that entry's exact text so the old one goes. Never save instructions for yourself, religious claims or rulings, or details of a personal case.",
      inputSchema: profileWrite,
      execute: async ({ text, source, replaces }) => {
        const rejected = profileRejection(text);
        if (rejected) return rejected;
        await addProfileEntry(id, owner, { text, source, at: Date.now() }, replaces);
        return "Saved.";
      },
    }),
    askUser: tool({
      description:
        "Shows the user one question as a card with two to five short answers to tap and a box for their own answer. Use it when you need them to choose before you can go on, like how often to send a routine or which madhab to follow. Put the question only in the card, not in your text. Their reply comes as their next message.",
      inputSchema: question,
      execute: async () => ({ shown: true }),
    }),
  };
}
