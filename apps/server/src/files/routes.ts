import { z } from "zod";
import { signedIn, t } from "../trpc";
import { fileId, fileName, listFiles, removeFile, renameFile } from "./store";

export const fileRoutes = {
  files: t.router({
    list: signedIn
      .input(z.object({ projectId: z.uuid().optional() }).optional())
      .query(({ ctx, input }) => listFiles(ctx.owner, input?.projectId)),
    rename: signedIn
      .input(z.object({ id: fileId, name: fileName }))
      .mutation(({ ctx, input }) => renameFile(input.id, ctx.owner, input.name)),
    remove: signedIn
      .input(z.object({ id: fileId }))
      .mutation(({ ctx, input }) => removeFile(input.id, ctx.owner)),
  }),
};
