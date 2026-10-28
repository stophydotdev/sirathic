import { Output, streamText } from "ai";
import { z } from "zod";
import { sideOptions } from "../models/subscription";
import { listConnections } from "../plugins/connections";
import { type createProject, listProjects, saveOpener } from "../projects/projects";
import { reasonOf } from "../http";
import { listSessions, recentAsks } from "../chat/sessions";
import { getSettings } from "../account/settings";
import { ANSWER_MAX, question } from "../shared/messages";
import type { User } from "../account/users";
import { pickModels } from "../models/pick";

const OPENER_TIMEOUT_MS = 8_000;
const RECENT_CHATS = 30;
const RECENT_DAYS = 7;
const ASKED_CHATS = 12;
const DAY_MS = 86_400_000;
const FALLBACK_TOPICS = 4;
const TRAILING_QUESTION = /\s*[^.!?]*\?\s*$/u;

const opener = question.extend({ greeting: z.string().trim().min(1).max(300) });

const OPENER_PROMPT = `You are a bot the user just made in Sirathic, an Islamic answering app. Write your first message to them from what you know about them below.

greeting: one or two short sentences. Open with "Assalamu alaikum", with their name if you know it. With no job, say in one sentence what you can do for them, using only the list under "What you can do for them". With a job, say in a few words what you will do. Never call yourself by a placeholder name like "New bot", and don't ask anything here; the question comes next.
question: one short question, under 10 words. With no job, ask what they want you to take on first. With a job, ask the one thing you most need to know to do it well, like how often, what time or what level.
options: three or four answers they can tap, each two to five words, written the way they would say them. Take them from what they have worked on most in their recent messages, each as something you could take on for them, like "Zakat and money" or "Quran study". Leave out anything another of their bots already does. Never base one on a personal case, a sin, or a health or family matter; use study topics and interests only. If their recent messages are empty, offer one for the season or the day (the Islamic month, a Friday), a daily lesson, a habit like prayer reminders, and memorization, and use their madhab if it is set.

Write everything in the language given below.`;

type NewBot = Awaited<ReturnType<typeof createProject>>;

const listed = (label: string, items: readonly string[]) =>
  items.length > 0 ? `${label}:\n${items.map((item) => `- ${item}`).join("\n")}` : `${label}: none`;

async function profileOf(by: string, bot: NewBot, language: string | undefined) {
  const [settings, chats, asks, plugins, projects] = await Promise.all([
    getSettings(by),
    listSessions(by, "", RECENT_CHATS),
    recentAsks(by, new Date(Date.now() - RECENT_DAYS * DAY_MS), ASKED_CHATS),
    listConnections(by),
    listProjects(by),
  ]);
  const otherBots = projects.filter((project) => project.kind === "bot" && project.id !== bot.id);
  const month = new Intl.DateTimeFormat("en-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date());
  const connected = plugins.flatMap((plugin) => (plugin.connected ? [plugin.name] : []));
  const writeIn = settings.answerLanguage === "auto" ? language : settings.answerLanguage;
  const topics = [
    ...new Set(
      chats.flatMap((chat) =>
        chat.projectId === null && chat.title ? [chat.title.slice(0, ANSWER_MAX)] : [],
      ),
    ),
  ].slice(0, FALLBACK_TOPICS);
  const profile = [
    `Their name: ${settings.name || "not given"}`,
    `Your name: ${bot.name}`,
    `Your job: ${bot.instructions || "none yet"}`,
    `Madhab: ${settings.madhab === "none" ? "not set" : settings.madhab}`,
    `Language: ${writeIn ?? "the language of their recent chats"}`,
    `Today: ${weekday}, ${month}`,
    listed("Facts they shared", [
      ...settings.memory,
      ...otherBots.flatMap((other) => other.memory),
    ]),
    listed("Their recent messages, newest first", asks),
    listed(
      "Recent chats",
      chats.flatMap((chat) => (chat.title ? [chat.title] : [])),
    ),
    listed("Connected plugins", connected),
    listed("What you can do for them", [
      "teach them a little every day",
      "quiz them on what they learn",
      "remind them before prayers",
      "run routines while they're away",
      ...(settings.madhab === "none" ? [] : [`answer by the ${settings.madhab} madhab`]),
      ...(connected.length > 0 ? [`work in ${connected.join(", ")}`] : []),
    ]),
    listed(
      "Their other bots and the jobs they already do",
      otherBots.map(
        (other) => `${other.name}: ${other.instructions || other.title || "no job yet"}`,
      ),
    ),
  ].join("\n");
  return { profile, topics };
}

export async function openBot(user: User, bot: NewBot, language: string | undefined) {
  const known = await profileOf(user.id, bot, language).catch((err: Error) => {
    console.error(`bot opener has no profile: ${reasonOf(err)}`);
    return undefined;
  });
  if (!known) return bot;
  const written = await streamText({
    model: pickModels(user, undefined).models.small,
    instructions: OPENER_PROMPT,
    prompt: known.profile,
    output: Output.object({ schema: opener }),
    providerOptions: sideOptions,
    abortSignal: AbortSignal.timeout(OPENER_TIMEOUT_MS),
  }).output.then(
    (done) => ({
      ...done,
      greeting: done.greeting.replace(TRAILING_QUESTION, "") || done.greeting,
    }),
    (err: Error) => {
      console.error(`bot opener not written, using recent topics: ${reasonOf(err)}`);
      return known.topics.length > 1
        ? { greeting: null, question: null, options: known.topics }
        : undefined;
    },
  );
  return written ? saveOpener(bot.id, user.id, written) : bot;
}
