import { imageSearch } from "@sirathic/core/tools/imageSearch";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { reviewBot } from "../bots/review";
import { signedIn, t } from "../trpc";
import { isAnswering, stopAnswer } from "./answers";
import { track } from "./events";
import {
  deleteAllSessions,
  deleteSession,
  feedbackInput,
  forkInput,
  forkSession,
  listSessions,
  openSession,
  sessionId,
  sessionUpdate,
  setFeedback,
  updateSession,
} from "./sessions";

const session = z.object({ id: sessionId });

export const chatRoutes = {
  sessions: t.router({
    list: signedIn
      .input(z.object({ query: z.string().trim().optional() }).optional())
      .query(({ ctx, input }) => listSessions(ctx.owner, input?.query)),
    get: signedIn.input(session).query(async ({ ctx, input }) => {
      const messages = await openSession(input.id, ctx.owner);
      if (!messages) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no such session" });
      }
      return { messages, answering: isAnswering(ctx.owner, input.id) };
    }),
    stop: signedIn.input(session).mutation(({ ctx, input }) => {
      stopAnswer(ctx.owner, input.id);
    }),
    update: signedIn
      .input(sessionUpdate.safeExtend({ id: sessionId }))
      .mutation(({ ctx, input: { id, ...update } }) => updateSession(id, ctx.owner, update)),
    remove: signedIn
      .input(session)
      .mutation(({ ctx, input }) => deleteSession(input.id, ctx.owner)),
    removeAll: signedIn.mutation(({ ctx }) => deleteAllSessions(ctx.owner)),
    feedback: signedIn
      .input(feedbackInput.safeExtend({ id: sessionId }))
      .mutation(async ({ ctx, input: { id, ...feedback } }) => {
        const saved = await setFeedback(id, ctx.owner, feedback);
        if (feedback.value === "down") {
          void reviewBot({
            user: ctx.user,
            botId: id,
            why: { kind: "down", messageId: feedback.messageId },
          });
        }
        track(
          {
            name: "feedback.given",
            props: { value: feedback.value, reason: feedback.report?.reason },
          },
          ctx.owner,
        );
        return saved;
      }),
    fork: signedIn
      .input(forkInput.safeExtend({ id: sessionId }))
      .mutation(({ ctx, input: { id, ...fork } }) => forkSession(id, ctx.owner, fork)),
  }),
  media: t.router({
    images: signedIn
      .input(z.object({ q: z.string() }))
      .query(({ input }) => imageSearch({ query: input.q, limit: 10 })),
  }),
};
