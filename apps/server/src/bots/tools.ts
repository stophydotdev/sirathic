import { tool } from "ai";
import { z } from "zod";
import { botTitle, projectInstructions, projectName, updateProject } from "../projects/projects";

const oneEmoji = z
  .emoji()
  .max(16)
  .refine((text) => [...new Intl.Segmenter().segment(text)].length === 1, "send exactly one emoji");

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
    set_bot_job: tool({
      description:
        "Sets this bot's name, title and job. Call it when the bot has no job yet and the user says what they want from it, or when the user asks to change them. The name is one to three words, like Ramadan Coach or Arabic Tutor. The title is a short role, like Quranic Arabic tutor. Never a title of scholarship like Shaykh, Imam or Mufti, nor a name of Allah, a prophet or a companion. Keep the job to what the user asked, without rulings, rules or limits. The job is a few sentences in the user's words that tell the bot what to do in every reply. The user sees a line saying the bot was renamed, so don't repeat it.",
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
        "Reacts to the user's last message with one emoji, shown as a small pill on that message. Use it rarely and mirror the user: if they never use emoji, almost never react. It suits good news, something funny, thanks, or a moment where a quick 👍 says more than a sentence. Never use it instead of a reply, never on a request you have not answered, and never on hardship, loss, illness or something they confess: reply in words. Write your reply as usual after it.",
      inputSchema: z.object({ emoji: oneEmoji }),
      execute: async ({ emoji }) => ({ emoji }),
    }),
    update_profile: tool({
      description:
        "Changes this bot's name, title or description, only the fields you pass. The title is the short role label. Never a title of scholarship like Shaykh, Imam or Mufti, nor a name of Allah, a prophet or a companion. The description is the job text the user sees under Description in the bot's settings, so keep it in the user's words, and only what the bot does, never limits. Use it when the user asks to rename the bot or to change what it does. The user sees a line saying the bot was renamed, so don't repeat it.",
      inputSchema: z.object({
        name: projectName.optional(),
        title: botTitle.optional(),
        description: projectInstructions.min(1).optional(),
      }),
      execute: async ({ name, title, description }) => {
        if (name === undefined && title === undefined && description === undefined) {
          return "Nothing to change.";
        }
        const bot = await updateProject(id, owner, { name, title, instructions: description });
        return {
          ...(name !== undefined && { name: bot.name }),
          ...(title !== undefined && { title: bot.title }),
          ...(description !== undefined && { description: bot.instructions }),
        };
      },
    }),
  };
}
