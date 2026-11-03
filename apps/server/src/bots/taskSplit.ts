import { generateText, Output } from "ai";
import { z } from "zod";
import type { User } from "../account/users";
import { reasonOf } from "../http";
import { pickModels } from "../models/pick";
import { sideOptions } from "../models/subscription";

const MAX_TASKS = 4;
const TITLE_CHARS = 60;
const SPLIT_TIMEOUT_MS = 15_000;

const split = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        brief: z.string().trim().min(1).max(8000),
        bot: z.string().trim(),
      }),
    )
    .min(1)
    .max(MAX_TASKS),
});

const SPLIT_PROMPT = `You turn a message someone sent from their Tasks page into tasks for their bots.

Make one task for each separate thing they ask for, at most ${MAX_TASKS}. A single request stays one task. For each task give:
- title: a short name, under ${TITLE_CHARS} characters, like "Book dinner for Friday, 2 people"
- brief: a self-contained instruction with every name, date, number and link from the message that this task needs
- bot: the name of the bot from the list that fits the task best, or the picked bot when none fits better

Write titles and briefs in the language of the message.`;

type Bot = { id: string; name: string };

export async function splitTasks({
  user,
  text,
  bots,
  picked,
}: {
  user: User;
  text: string;
  bots: Bot[];
  picked: Bot;
}) {
  const alone = [{ title: text.slice(0, TITLE_CHARS), brief: text, botId: picked.id }];
  const found = await generateText({
    model: pickModels(user, undefined).models.small,
    instructions: `${SPLIT_PROMPT}\n\nBots: ${bots.map((bot) => bot.name).join(", ")}\nPicked bot: ${picked.name}`,
    prompt: text,
    output: Output.object({ schema: split }),
    providerOptions: sideOptions,
    abortSignal: AbortSignal.timeout(SPLIT_TIMEOUT_MS),
  }).then(
    (done) => done.output,
    (err: Error) => {
      console.error(`tasks not split, starting one: ${reasonOf(err)}`);
      return undefined;
    },
  );
  if (!found) return alone;
  return found.tasks.map((task) => ({
    title: task.title,
    brief: task.brief,
    botId: bots.find((bot) => bot.name.toLowerCase() === task.bot.toLowerCase())?.id ?? picked.id,
  }));
}
