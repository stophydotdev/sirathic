import { z } from "zod";
import { projectId } from "../projects/projects";
import { signedIn, t } from "../trpc";
import { learnedLine, noteId, undoNote } from "./notes";
import { progressOf } from "./study";
import { runningTasksOf, type TaskView } from "./taskBook";
import { readEndedTasks } from "./taskHistory";

const bot = z.object({ botId: projectId });

export const botRoutes = {
  study: t.router({
    progress: signedIn
      .input(z.object({ id: projectId }))
      .query(({ ctx, input }) => progressOf({ id: input.id, owner: ctx.owner })),
  }),
  tasks: t.router({
    list: signedIn.query(async ({ ctx }): Promise<TaskView[]> => {
      const ended = await readEndedTasks(ctx.owner);
      const running = runningTasksOf(ctx.owner).map(({ botId, task }): TaskView => ({
        id: task.id,
        botId,
        title: task.title,
        state: "running",
        now: task.now,
        startedAt: task.startedAt,
        endedAt: undefined,
      }));
      return [
        ...running,
        ...ended.map((task): TaskView => Object.assign(task, { now: undefined })),
      ];
    }),
  }),
  notes: t.router({
    learned: signedIn.input(bot).query(({ ctx, input }) => learnedLine(input.botId, ctx.owner)),
    undo: signedIn
      .input(bot.extend({ id: noteId }))
      .mutation(({ ctx, input }) => undoNote(input.botId, ctx.owner, input.id)),
  }),
};
