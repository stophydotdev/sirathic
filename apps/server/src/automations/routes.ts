import { z } from "zod";
import { getSettings } from "../account/settings";
import { signedIn, t } from "../trpc";
import { runNow } from "./runner";
import {
  automationId,
  automationInput,
  automationUpdate,
  createAutomation,
  listAutomations,
  listRuns,
  removeAutomation,
  updateAutomation,
} from "./store";

export const automationRoutes = {
  automations: t.router({
    list: signedIn.query(({ ctx }) => listAutomations(ctx.owner)),
    runs: signedIn.query(({ ctx }) => listRuns(ctx.owner)),
    create: signedIn.input(automationInput).mutation(async ({ ctx, input }) =>
      createAutomation(ctx.owner, {
        ...input,
        timezone: (await getSettings(ctx.owner)).timezone || input.timezone,
      }),
    ),
    update: signedIn
      .input(automationUpdate.safeExtend({ id: automationId }))
      .mutation(({ ctx, input: { id, ...update } }) => updateAutomation(id, ctx.owner, update)),
    remove: signedIn
      .input(z.object({ id: automationId }))
      .mutation(({ ctx, input }) => removeAutomation(input.id, ctx.owner)),
    runNow: signedIn
      .input(z.object({ id: automationId }))
      .mutation(({ ctx, input }) => runNow(input.id, ctx.owner)),
  }),
};
