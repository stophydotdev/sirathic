import { Output, streamText } from "ai";
import { z } from "zod";
import { sideOptions } from "../chatgpt/codex";
import { listConnections } from "../connectors/connections";
import { type createProject, listProjects, saveOpener } from "../projects";
import { reasonOf } from "../respond";
import { listSessions } from "../sessions";
import { getSettings } from "../settings";
import { question } from "../shared/messages";
import type { User } from "../users";
import { pickModels } from "./models";

const OPENER_TIMEOUT_MS = 4_000;
const RECENT_CHATS = 30;

const opener = question.extend({ greeting: z.string().trim().min(1).max(300) });

const OPENER_PROMPT = `You are a bot the user just made in Sirathic, an Islamic answering app. Write your first message to them, using what you know about them below.

greeting: one or two short sentences. Open with "Assalamu alaikum", with their name if you know it. If you have a job, say in a few words what you will do for them.
question: one short question, under 12 words, that helps you set up. With no job, ask what they want help with. With a job, ask the one thing you most need to know to do it well, like how often, what time or what level.
options: three to five answers they can tap, each under 60 characters, written the way they would say them, like "Teach me one hadith a day". Ground each one in what you know: what they asked about recently, the facts they shared, their madhab, their connected plugins and the Islamic month. Never suggest a bot they already have. If you know nothing about them, offer common needs: studying the Quran, a hadith a day, Quranic Arabic, guidance for a new Muslim, fiqh questions.

Write everything in the language given below.`;

type NewBot = Awaited<ReturnType<typeof createProject>>;

const listed = (label: string, items: readonly string[]) =>
  items.length > 0 ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}` : `${label}: none`;

async function profileOf(by: string, bot: NewBot, language: string | undefined) {
  const [settings, chats, plugins, projects] = await Promise.all([
    getSettings(by),
    listSessions(by, "", RECENT_CHATS),
    listConnections(by),
    listProjects(by),
  ]);
  const month = new Intl.DateTimeFormat("en-u-ca-islamic", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  const writeIn = settings.answerLanguage === "auto" ? language : settings.answerLanguage;
  return [
    `Their name: ${settings.name || "not given"}`,
    `Your name: ${bot.name}`,
    `Your job: ${bot.instructions || "none yet"}`,
    `Madhab: ${settings.madhab === "none" ? "not set" : settings.madhab}`,
    `Language: ${writeIn ?? "the language of their recent chats"}`,
    `Islamic month: ${month}`,
    listed("Facts they shared", settings.memory),
    listed(
      "Recent chats",
      chats.flatMap((chat) => (chat.title ? [chat.title] : [])),
    ),
    listed(
      "Connected plugins",
      plugins.flatMap((plugin) => (plugin.connected ? [plugin.name] : [])),
    ),
    listed(
      "Bots they already have",
      projects.flatMap((project) =>
        project.kind === "bot" && project.id !== bot.id ? [project.name] : [],
      ),
    ),
  ].join("\n");
}

export const openBot = (user: User, bot: NewBot, language: string | undefined) =>
  profileOf(user.id, bot, language)
    .then(
      (profile) =>
        streamText({
          model: pickModels(user, undefined).models.small,
          instructions: OPENER_PROMPT,
          prompt: profile,
          output: Output.object({ schema: opener }),
          providerOptions: sideOptions,
          abortSignal: AbortSignal.timeout(OPENER_TIMEOUT_MS),
        }).output,
    )
    .then((written) => saveOpener(bot.id, user.id, written))
    .catch((err: Error) => {
      console.error(`bot opener not written: ${reasonOf(err)}`);
      return bot;
    });
