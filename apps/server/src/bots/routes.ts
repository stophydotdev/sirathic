import { z } from "zod";
import { projectId } from "../projects/projects";
import { signedIn, t } from "../trpc";
import { learnedLine, noteId, undoNote } from "./notes";
import { progressOf } from "./study";

const bot = z.object({ botId: projectId });

export const botRoutes = {
  study: t.router({
    progress: signedIn
      .input(z.object({ id: projectId }))
      .query(({ ctx, input }) => progressOf({ id: input.id, owner: ctx.owner })),
  }),
  notes: t.router({
    learned: signedIn.input(bot).query(({ ctx, input }) => learnedLine(input.botId, ctx.owner)),
    undo: signedIn
      .input(bot.extend({ id: noteId }))
      .mutation(({ ctx, input }) => undoNote(input.botId, ctx.owner, input.id)),
  }),
};
