import { keepFor } from "@sirathic/core/cache";
import { z } from "zod";
import { signedIn, t } from "../trpc";
import { emailEditKey, outgoingEmail } from "./outgoingEmail";

const EDIT_KEPT_SECONDS = 10 * 60;

export const emailRoutes = {
  emailEdits: t.router({
    save: signedIn
      .input(z.object({ toolCallId: z.string().min(1).max(200), email: outgoingEmail }))
      .mutation(({ ctx, input }) =>
        keepFor(
          emailEditKey(ctx.owner, input.toolCallId),
          JSON.stringify(input.email),
          EDIT_KEPT_SECONDS,
        ),
      ),
  }),
};
