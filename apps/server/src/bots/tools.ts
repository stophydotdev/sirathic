import { tool } from "ai";
import { z } from "zod";
import { botTitle, projectInstructions, projectName, updateProject } from "../projects/projects";

export type BotScope = { id: string; owner: string };

export const BOT_HISTORY = 40;

const CHUNK_SHARE = 0.6;

export const recentTurns = <Message extends { role: string }>(
  messages: Message[],
  limit: number,
) => {
  const chunk = Math.ceil(limit * CHUNK_SHARE);
  const cut = messages.length <= limit ? 0 : Math.ceil((messages.length - limit) / chunk) * chunk;
  const recent = messages.slice(cut);
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
  };
}
