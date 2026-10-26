import { NOOR_MODELS } from "../models/noor";
import { DEFAULT_MODEL, models } from "../models/subscription";
import { settingsUpdate } from "../shared/settings";
import { procedure, signedIn, t } from "../trpc";
import { getSettings, updateSettings } from "./settings";

const isDefault = (model: { slug: string }) => Number(model.slug === DEFAULT_MODEL);

export const accountRoutes = {
  settings: t.router({
    get: signedIn.query(({ ctx }) => getSettings(ctx.owner)),
    update: signedIn
      .input(settingsUpdate)
      .mutation(({ ctx, input }) => updateSettings(ctx.owner, input)),
  }),
  account: t.router({
    status: procedure.query(({ ctx }) =>
      ctx.user
        ? {
            signedIn: true as const,
            label: ctx.user.email,
            image: ctx.user.image,
            via: ctx.user.via,
          }
        : { signedIn: false as const },
    ),
    models: procedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return [
        ...NOOR_MODELS,
        ...(ctx.user.via === "chatgpt" ? await models(ctx.user) : []),
      ].toSorted((a, b) => isDefault(b) - isDefault(a));
    }),
  }),
};
