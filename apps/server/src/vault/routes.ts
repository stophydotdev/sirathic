import { z } from "zod";
import { signedIn, t } from "../trpc";
import {
  connectOnePassword,
  disconnectOnePassword,
  listVault,
  onePasswordToken,
  removeFromVault,
  saveLogin,
  vaultLogin,
} from "./vault";

export const vaultRoutes = {
  vault: t.router({
    list: signedIn.query(({ ctx }) => listVault(ctx.owner)),
    save: signedIn.input(vaultLogin).mutation(({ ctx, input }) => saveLogin(ctx.owner, input)),
    remove: signedIn
      .input(z.object({ id: z.uuid() }))
      .mutation(({ ctx, input }) => removeFromVault(ctx.owner, input.id)),
    connectOnePassword: signedIn
      .input(z.object({ token: onePasswordToken }))
      .mutation(({ ctx, input }) => connectOnePassword(ctx.owner, input.token)),
    disconnectOnePassword: signedIn.mutation(({ ctx }) => disconnectOnePassword(ctx.owner)),
  }),
};
