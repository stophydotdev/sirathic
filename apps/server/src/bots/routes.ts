import { z } from "zod";
import { StatusError } from "../http";
import { pickModels } from "../models/pick";
import { checkNoorUsage } from "../models/usage";
import { listProjects, projectId } from "../projects/projects";
import { DEFAULT_EFFORT } from "../shared/messages";
import { timezone } from "../shared/settings";
import { signedIn, t } from "../trpc";
import { taskAnswer } from "./askUser";
import { learnedLine, noteId, undoNote } from "./notes";
import { progressOf } from "./study";
import { openTasksOf, stopTasks, taskOf, type TaskView } from "./taskBook";
import { forgetEndedTask, readEndedTasks } from "./taskHistory";
import { answerTask, launchTask } from "./taskRun";
import { splitTasks } from "./taskSplit";

const bot = z.object({ botId: projectId });
const task = z.object({ parentId: projectId, id: z.string().min(1).max(20) });

const endedTaskOf = async (owner: string, id: string) => {
  const found = (await readEndedTasks(owner)).find((ended) => ended.id === id);
  if (!found) throw new StatusError(404, "no such task");
  return found;
};

export const botRoutes = {
  study: t.router({
    progress: signedIn
      .input(z.object({ id: projectId }))
      .query(({ ctx, input }) => progressOf({ id: input.id, owner: ctx.owner })),
  }),
  tasks: t.router({
    list: signedIn.query(async ({ ctx }): Promise<TaskView[]> => {
      const ended = await readEndedTasks(ctx.owner);
      return [
        ...openTasksOf(ctx.owner),
        ...ended.map((done): TaskView => ({
          id: done.id,
          parentId: done.parentId ?? done.botId,
          botId: done.botId,
          title: done.title,
          state: done.state,
          now: undefined,
          waiting: undefined,
          result: done.result,
          reason: done.reason,
          startedAt: done.startedAt,
          endedAt: done.endedAt,
        })),
      ];
    }),
    get: signedIn.input(task).query(async ({ ctx, input }) => {
      const open = taskOf({ id: input.parentId, owner: ctx.owner }, input.id);
      if (open && !open.end) return { brief: open.brief, steps: open.steps, sources: [] };
      const { brief, steps, sources } = await endedTaskOf(ctx.owner, input.id);
      return { brief, steps, sources };
    }),
    add: signedIn
      .input(
        bot.extend({ text: z.string().trim().min(1).max(8000), timezone: timezone.optional() }),
      )
      .mutation(async ({ ctx, input }) => {
        const bots = await listProjects(ctx.owner);
        const picked = bots.find((one) => one.id === input.botId);
        if (!picked) throw new StatusError(404, "no such bot");
        const { modelName } = pickModels(ctx.user, undefined);
        await checkNoorUsage({
          by: ctx.owner,
          modelName,
          timeZone: input.timezone,
          offerGpt: ctx.user.via !== "chatgpt",
        });
        const style = { modelName, effort: DEFAULT_EFFORT.quick, timezone: input.timezone };
        const parts = await splitTasks({ user: ctx.user, text: input.text, bots, picked });
        return parts.map(
          (part) =>
            launchTask({
              bot: { id: picked.id, owner: ctx.owner },
              runner: { id: part.botId, owner: ctx.owner },
              title: part.title,
              brief: part.brief,
              resume: undefined,
              style,
            }).id,
        );
      }),
    answer: signedIn.input(task.extend({ answer: taskAnswer })).mutation(({ ctx, input }) => {
      answerTask({ id: input.parentId, owner: ctx.owner }, input.id, input.answer);
      return { answered: true };
    }),
    stop: signedIn.input(task).mutation(({ ctx, input }) => {
      const { stopped } = stopTasks({ id: input.parentId, owner: ctx.owner }, input.id);
      return { stopped: stopped.length > 0 };
    }),
    retry: signedIn.input(task).mutation(async ({ ctx, input }) => {
      const ended = await endedTaskOf(ctx.owner, input.id);
      const { modelName } = pickModels(ctx.user, undefined);
      const started = launchTask({
        bot: { id: ended.parentId ?? ended.botId, owner: ctx.owner },
        runner: { id: ended.botId, owner: ctx.owner },
        title: ended.title,
        brief: ended.brief || ended.title,
        resume: undefined,
        style: { modelName, effort: DEFAULT_EFFORT.quick, timezone: undefined },
      });
      await forgetEndedTask(ctx.owner, input.id);
      return { id: started.id };
    }),
    dismiss: signedIn.input(task).mutation(async ({ ctx, input }) => {
      await forgetEndedTask(ctx.owner, input.id);
      return { dismissed: true };
    }),
  }),
  notes: t.router({
    learned: signedIn.input(bot).query(({ ctx, input }) => learnedLine(input.botId, ctx.owner)),
    undo: signedIn
      .input(bot.extend({ id: noteId }))
      .mutation(({ ctx, input }) => undoNote(input.botId, ctx.owner, input.id)),
  }),
};
