import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { isReadOnly } from "../chat/confirm";
import { checkNoorUsage } from "../models/usage";
import { launchTask } from "./taskRun";
import {
  STEPS_SHOWN,
  stateOf,
  stopTasks,
  type Style,
  type Task,
  taskOf,
  tasksOf,
} from "./taskBook";
import type { BotScope } from "./tools";

const taskId = z.string().trim().min(1).describe("The id start_task returned");

const reportOf = (task: Task) => ({
  id: task.id,
  title: task.title,
  state: stateOf(task),
  seconds: Math.round(((task.endedAt ?? Date.now()) - task.startedAt) / 1000),
  lastSteps: task.steps.slice(-STEPS_SHOWN),
  ...(task.end?.kind === "done" && { result: task.end.text }),
  ...(task.end?.kind === "failed" && { reason: task.end.reason }),
});

export const readingOnly = (tools: ToolSet) =>
  Object.fromEntries(Object.entries(tools).filter(([, entry]) => isReadOnly(entry)));

export function taskTools(bot: BotScope, style: Style) {
  return {
    start_task: tool({
      description:
        "Starts a background task: a separate worker that does one piece of work on its own while you stay available to the user. It returns at once. It cannot see this chat or the user, so its brief must be self-contained: the goal, the context and exact values it needs, and what to report back. It works as you do, with your tools, files, browser and memory, but it cannot ask the user anything. Its connected apps only read, and it does not send messages or pay: anything consequential comes back to you in its result for you to do. Its final message comes back to you, not the user, and you are woken to deliver it. To follow up with a task that finished, pass its id as resume and it keeps its context. Without resume, each call starts fresh. Typically one or two tasks run at a time; four is the most.",
      inputSchema: z.object({
        title: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .describe("A short name for the task, like 'Hajj visa research'"),
        brief: z.string().trim().min(1).max(8000),
        resume: taskId.optional(),
      }),
      execute: async ({ title, brief, resume }) => {
        await checkNoorUsage({
          by: bot.owner,
          modelName: style.modelName,
          timeZone: style.timezone,
          offerGpt: false,
        });
        return reportOf(launchTask({ bot, title, brief, resume, style }));
      },
    }),
    check_task: tool({
      description:
        "Checks how a background task you started is doing without waiting for it to finish. Returns its state, how long it has run and its last few steps. Pass its id, or omit it to list every task. Use this when a task has run unusually long or might be stuck or looping, so you can decide whether to message or stop it. This is read-only, and it is not polling for completion: you are woken when a task finishes.",
      inputSchema: z.object({ id: taskId.optional() }),
      execute: ({ id }) => {
        const found = id === undefined ? tasksOf(bot) : [taskOf(bot, id)].flatMap((t) => t ?? []);
        if (id !== undefined && found.length === 0) throw new Error("No task has that id.");
        return { tasks: found.map(reportOf) };
      },
    }),
    message_task: tool({
      description:
        "Sends a note into a running background task to course-correct it without stopping it. The task reads your note at its next step and continues from where it was, with its context intact. Use this to unstick or redirect a task that is looping or heading the wrong way, for example to tell it to try a different source or to wrap up and report what it has. You are still woken with its result when it finishes. To follow up after a task has finished, use start_task with resume.",
      inputSchema: z.object({ id: taskId, note: z.string().trim().min(1).max(2000) }),
      execute: ({ id, note }) => {
        const found = taskOf(bot, id);
        if (!found) throw new Error("No task has that id.");
        if (found.end) {
          throw new Error("That task has finished. Use start_task with resume to follow up.");
        }
        found.notes.push(note);
        return { id, state: "running", note: "It reads this at its next step." };
      },
    }),
    stop_task: tool({
      description:
        "Stops background tasks you started. Pass one task's id to stop one that is wedged, looping with no progress, or no longer needed. Pass all: true to stop every running task at once. This is the call to make when the user asks you to stop, halt, cancel or quit the current work, and it must be your first action for that request, rather than checking or stopping tasks one by one. A stopped task does not come back and you are not woken for it. The result lists which tasks were stopped and which had already finished.",
      inputSchema: z
        .object({ id: taskId.optional(), all: z.literal(true).optional() })
        .refine((input) => (input.id === undefined) !== (input.all === undefined), {
          message: "Pass an id, or all: true, not both.",
        }),
      execute: ({ id }) => {
        const { stopped, alreadyEnded } = stopTasks(bot, id);
        if (id !== undefined && stopped.length + alreadyEnded.length === 0) {
          throw new Error("No task has that id.");
        }
        return {
          stopped: stopped.map((task) => task.id),
          alreadyFinished: alreadyEnded.map((task) => task.id),
        };
      },
    }),
  };
}
