import { z } from "zod";
import { signedIn, t } from "../trpc";
import { listSkills, removeSkill, saveSkill, skillInput } from "./skills";

export const skillRoutes = {
  skills: t.router({
    list: signedIn.query(({ ctx }) => listSkills(ctx.owner)),
    save: signedIn.input(skillInput).mutation(({ ctx, input }) => saveSkill(ctx.owner, input)),
    remove: signedIn
      .input(z.object({ id: z.uuid() }))
      .mutation(({ ctx, input }) => removeSkill(ctx.owner, input.id)),
  }),
};
