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
});

const endedTasks = z.array(endedTask);

const keyOf = (owner: string) => `tasks:${owner}`;

export async function readEndedTasks(owner: string) {
  const kept = await readKept(keyOf(owner)).catch(() => null);
  if (kept === null) return [];
  return endedTasks.catch([]).parse(JSON.parse(kept));
}

let writing = Promise.resolve();

export function rememberEndedTask(owner: string, task: z.infer<typeof endedTask>) {
  writing = writing
    .then(async () => {
      const earlier = await readEndedTasks(owner);
      const next = [task, ...earlier.filter(({ id }) => id !== task.id)].slice(0, KEPT_TASKS);
      await keepFor(keyOf(owner), JSON.stringify(next), KEPT_SECONDS);
    })
    .catch((err: Error) => {
      console.error(`task history not saved: ${reasonOf(err)}`);
    });
}
