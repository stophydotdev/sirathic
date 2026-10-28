import { NOOR_MODELS } from "../models/noor";
import { DEFAULT_MODEL, models, usage } from "../models/subscription";
import { noorUsage } from "../models/usage";
import { settingsUpdate } from "../shared/settings";
import { z } from "zod";
import { StatusError } from "../http";
import { procedure, signedIn, t } from "../trpc";
import { auth } from "./auth";
import { deleteAccount, exportData } from "./data";
import { moveRoutines } from "../automations/store";
import { listDevices, signOutDevice, signOutOthers } from "./devices";
import { getSettings, updateSettings } from "./settings";

const isDefault = (model: { slug: string }) => Number(model.slug === DEFAULT_MODEL);

const sessionOf = async (headers: Headers) => {
  const found = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  if (!found) throw new StatusError(401, "not signed in");
  return found.session.id;
};

export const accountRoutes = {
  settings: t.router({
    get: signedIn.query(({ ctx }) => getSettings(ctx.owner)),
    update: signedIn.input(settingsUpdate).mutation(async ({ ctx, input }) => {
      if (input.timezone) await moveRoutines(ctx.owner, input.timezone);
      return updateSettings(ctx.owner, input);
    }),
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
    devices: signedIn.query(async ({ ctx }) =>
      listDevices(ctx.owner, await sessionOf(ctx.headers)),
    ),
    signOutOthers: signedIn.mutation(async ({ ctx }) =>
      signOutOthers(ctx.owner, await sessionOf(ctx.headers)),
    ),
    signOutDevice: signedIn
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) =>
        signOutDevice(ctx.owner, await sessionOf(ctx.headers), input.id),
      ),
    usage: signedIn.query(async ({ ctx }) => {
      const [noor, chatgpt] = await Promise.all([
        noorUsage(ctx.owner),
        ctx.user.via === "chatgpt" ? usage(ctx.user).catch(() => null) : null,
      ]);
      return { noor, chatgpt };
    }),
    export: signedIn.query(({ ctx }) => exportData(ctx.owner)),
    delete: signedIn.mutation(({ ctx }) => deleteAccount(ctx.owner)),
  }),
};
