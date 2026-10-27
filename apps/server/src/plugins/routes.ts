import { z } from "zod";
import { signedIn, t } from "../trpc";
import { pluginId } from "./catalog";
import { addCustom, connect, customInput, disconnect, listConnections } from "./connections";

const plugin = z.object({ id: pluginId });

export const pluginRoutes = {
  connectors: t.router({
    list: signedIn.query(({ ctx }) => listConnections(ctx.owner)),
    connect: signedIn.input(plugin).mutation(({ ctx, input }) => connect(ctx.owner, input.id)),
    disconnect: signedIn
      .input(plugin)
      .mutation(({ ctx, input }) => disconnect(ctx.owner, input.id)),
    addCustom: signedIn
      .input(customInput)
      .mutation(({ ctx, input }) => addCustom(ctx.owner, input)),
  }),
};
