import { z } from "zod";
import { openBot } from "../bots/opener";
import { appLanguage } from "../shared/messages";
import { signedIn, t } from "../trpc";
import {
  createProject,
  listProjects,
  projectId,
  projectInput,
  projectUpdate,
  removeProject,
  updateProject,
} from "./projects";

export const projectRoutes = {
  projects: t.router({
    list: signedIn.query(({ ctx }) => listProjects(ctx.owner)),
    create: signedIn
      .input(projectInput.safeExtend({ language: appLanguage.optional() }))
      .mutation(async ({ ctx, input: { language, ...input } }) => {
        const created = await createProject(ctx.owner, input);
        return created.kind === "bot" ? openBot(ctx.user, created, language) : created;
      }),
    update: signedIn
      .input(projectUpdate.safeExtend({ id: projectId }))
      .mutation(({ ctx, input: { id, ...update } }) => updateProject(id, ctx.owner, update)),
    remove: signedIn
      .input(z.object({ id: projectId }))
      .mutation(({ ctx, input }) => removeProject(input.id, ctx.owner)),
  }),
};
