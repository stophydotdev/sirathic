import { keepFor, readKept } from "@sirathic/core/cache";
import { z } from "zod";
import { reasonOf } from "../http";

const KEPT_TASKS = 50;
const KEPT_SECONDS = 7 * 24 * 60 * 60;

export const endedTask = z.object({
  id: z.string(),
  botId: z.string(),
  title: z.string(),
  state: z.enum(["done", "failed", "cutOff", "stopped"]),
  startedAt: z.number(),
  endedAt: z.number(),
  parentId: z.string().optional(),
  brief: z.string().default(""),
  result: z.string().optional(),
  reason: z.string().optional(),
  steps: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
});

const endedTasks = z.array(endedTask);

const keyOf = (owner: string) => `tasks:${owner}`;

export async function readEndedTasks(owner: string) {
  const kept = await readKept(keyOf(owner)).catch(() => null);
  if (kept === null) return [];
  return endedTasks.catch([]).parse(JSON.parse(kept));
}

let writing = Promise.resolve();

type EndedTask = z.infer<typeof endedTask>;

const rewrite = (owner: string, change: (earlier: EndedTask[]) => EndedTask[]) => {
  writing = writing
    .then(async () => {
      const next = change(await readEndedTasks(owner)).slice(0, KEPT_TASKS);
      await keepFor(keyOf(owner), JSON.stringify(next), KEPT_SECONDS);
    })
    .catch((err: Error) => {
      console.error(`task history not saved: ${reasonOf(err)}`);
    });
  return writing;
};

export const rememberEndedTask = (owner: string, task: z.input<typeof endedTask>) => {
  const kept = endedTask.parse(task);
  return rewrite(owner, (earlier) => [kept, ...earlier.filter(({ id }) => id !== kept.id)]);
};

export const forgetEndedTask = (owner: string, id: string) =>
  rewrite(owner, (earlier) => earlier.filter((task) => task.id !== id));
