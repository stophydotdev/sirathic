import { countUp } from "@sirathic/core/cache";
import { imageSearch } from "@sirathic/core/tools/imageSearch";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { reviewBot } from "../bots/review";
import { device } from "../shared/messages";
import { procedure, signedIn, t } from "../trpc";
import { isAnswering, stopAnswer } from "./answers";
import { appOf, clientOf } from "./client";
import { browserEvent, track } from "./events";
import { publishedPage, publishSession } from "./pages";
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

const TWO_DAYS = 2 * 24 * 60 * 60;

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
    publish: signedIn
      .input(session.extend({ published: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const done = await publishSession(input.id, ctx.owner, input.published);
        if (!done) throw new TRPCError({ code: "NOT_FOUND", message: "no such chat" });
        return done;
      }),
    fork: signedIn
      .input(forkInput.safeExtend({ id: sessionId }))
      .mutation(({ ctx, input: { id, ...fork } }) => forkSession(id, ctx.owner, fork)),
  }),
  pages: t.router({
    get: procedure.input(session).query(async ({ input }) => {
      const page = await publishedPage(input.id);
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "no such page" });
      return page;
    }),
  }),
  media: t.router({
    images: signedIn
      .input(z.object({ q: z.string() }))
      .query(({ input }) => imageSearch({ query: input.q, limit: 10 })),
  }),
  events: t.router({
    record: signedIn.input(browserEvent).mutation(({ ctx, input }) => track(input, ctx.owner)),
    opened: signedIn
      .input(z.object({ device: device.optional() }))
      .mutation(async ({ ctx, input }) => {
        const today = new Date().toISOString().slice(0, 10);
        if ((await countUp(`app-opened:${today}:${ctx.owner}`, TWO_DAYS)) > 1) return;
        track(
          {
            name: "app.opened",
            props: { app: appOf(ctx.headers), device: input.device, ...clientOf(ctx.headers) },
          },
          ctx.owner,
        );
      }),
  }),
};
