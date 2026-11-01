import { z } from "zod";
import { signedIn, t } from "../trpc";
import { saveContact, updateContact, vaultContact } from "./contacts";
import { addLogin, listVault, openItem, removeFromVault, updateLogin, vaultLogin } from "./vault";

export const vaultRoutes = {
  vault: t.router({
    list: signedIn.query(({ ctx }) => listVault(ctx.owner)),
    save: signedIn.input(vaultLogin).mutation(({ ctx, input }) => addLogin(ctx.owner, input)),
    saveContact: signedIn
      .input(vaultContact)
      .mutation(({ ctx, input }) => saveContact(ctx.owner, input)),
    open: signedIn
      .input(z.object({ id: z.uuid() }))
      .query(({ ctx, input }) => openItem(ctx.owner, input.id)),
    update: signedIn
      .input(z.object({ id: z.uuid(), login: vaultLogin }))
      .mutation(({ ctx, input }) => updateLogin(ctx.owner, input.id, input.login)),
    updateContact: signedIn
      .input(z.object({ id: z.uuid(), contact: vaultContact }))
      .mutation(({ ctx, input }) => updateContact(ctx.owner, input.id, input.contact)),
    remove: signedIn
      .input(z.object({ id: z.uuid() }))
      .mutation(({ ctx, input }) => removeFromVault(ctx.owner, input.id)),
  }),
};
