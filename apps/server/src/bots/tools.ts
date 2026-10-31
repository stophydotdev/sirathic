import { tool } from "ai";
import { z } from "zod";
import { botTitle, projectInstructions, projectName, updateProject } from "../projects/projects";
import { oneEmoji } from "../shared/messages";
import { BOT_BODIES, BOT_COLORS } from "../shared/projects";

export type BotScope = { id: string; owner: string };

export const BOT_HISTORY = 40;

const CHUNK_SHARE = 0.6;

export const NAMING =
  "Never a title of scholarship like Shaykh, Imam or Mufti, nor a name only Allah carries, like Allah, ar-Rahman or al-Khaliq. A shared name like Hakim or Karim, or a prophet's or companion's name, is fine as a plain name.";

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
    set_bot_job: tool({
      description: `Sets this bot's name, title and job. Call it when the bot has no job yet and the user says what they want from it, or when the user asks to change them. The name is one to three words, like Ramadan Coach or Arabic Tutor. The title is a short role, like Quranic Arabic tutor. ${NAMING} Keep the job to what the user asked, without rulings, and without limits they did not ask for. The job is a few sentences in the user's words that tell the bot what to do in every reply. The user sees a line saying the bot was renamed, so don't repeat it.`,
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
    react_to_message: tool({
      description:
        "Reacts to the user's last message with a single emoji, shown as a small pill on that message. Use it rarely and mirror the user: if they don't use emoji, almost never react. It suits something funny, good news, or a moment where a quick 👍 beats a sentence, never a request you haven't answered and never just to seem friendly. Never on hardship, loss, illness or something they confess: reply in words. When a reply would be overkill, the reaction can be your whole reply.",
      inputSchema: z.object({ emoji: oneEmoji }),
      execute: async ({ emoji }) => ({ emoji }),
    }),
    update_profile: tool({
      description: `Changes this bot's name, title, description, avatar color or avatar body. Only the fields you pass change. The title is a short role label beside the name. ${NAMING} The description is the job text the user sees under Description in the bot's settings, so keep it in the user's words, and only what the bot does, never limits. Change the avatar color or body only when the user asks. Use it when the user asks to rename the bot, change how it looks or change what it does. The user sees a line saying the bot was renamed, so don't repeat it.`,
      inputSchema: z.object({
        name: projectName.optional(),
        title: botTitle.optional(),
        description: projectInstructions.min(1).optional(),
        color: z.enum(BOT_COLORS).optional(),
        body: z.enum(BOT_BODIES).optional(),
      }),
      execute: async ({ name, title, description, color, body }) => {
        if ([name, title, description, color, body].every((field) => field === undefined)) {
          return "Nothing to change.";
        }
        const bot = await updateProject(id, owner, {
          name,
          title,
          instructions: description,
          color,
          symbol: body,
        });
        return {
          ...(name !== undefined && { name: bot.name }),
          ...(title !== undefined && { title: bot.title }),
          ...(description !== undefined && { description: bot.instructions }),
          ...(color !== undefined && { color: bot.color }),
          ...(body !== undefined && { body: bot.symbol }),
        };
      },
    }),
  };
}
