import { imageSearch } from "@sirathic/core/tools/imageSearch";
import { youtubeSearch } from "@sirathic/core/tools/youtubeSearch";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEFAULT_MODEL, models } from "./chatgpt/codex";
import { GEMINI_MODELS } from "./gemini";
import { NOOR_MODELS } from "./noor";
import { userFor } from "./auth";
import { track } from "./events";
import { StatusError } from "./respond";
import { getSettings, updateSettings } from "./settings";
import {
  deleteAllSessions,
  deleteSession,
  exportSessions,
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
import { settingsUpdate } from "./shared/settings";
import { suggestions } from "./suggest";

const LIBRARY_LIMIT = 500;

const TRPC_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  429: "TOO_MANY_REQUESTS",
  502: "BAD_GATEWAY",
} as const satisfies Record<StatusError["status"], TRPCError["code"]>;

export const createContext = async (headers: Headers) => ({
  user: await userFor(headers),
});

const t = initTRPC
  .context<Awaited<ReturnType<typeof createContext>>>()
  .create();

const procedure = t.procedure.use(async ({ ctx, next, path }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof StatusError) {
    throw new TRPCError({
      code: TRPC_CODES[result.error.cause.status],
      message: result.error.cause.message,
    });
  }
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    track(
      { name: "api.failed", props: { route: path, code: result.error.code } },
      ctx.user?.id,
    );
  }
  return result;
});

const signedIn = procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "not signed in",
    });
  }
  return next({ ctx: { user: ctx.user, owner: ctx.user.id } });
});

const session = z.object({ id: sessionId });

const isDefault = (model: { slug: string }) =>
  Number(model.slug === DEFAULT_MODEL);

export const appRouter = t.router({
  sessions: t.router({
    list: signedIn
      .input(
        z
          .object({
            query: z.string().trim().optional(),
            all: z.boolean().optional(),
          })
          .optional(),
      )
      .query(({ ctx, input }) =>
        listSessions(
          ctx.owner,
          input?.query,
          input?.all ? LIBRARY_LIMIT : undefined,
        ),
      ),
    get: signedIn.input(session).query(async ({ ctx, input }) => {
      const messages = await openSession(input.id, ctx.owner);
      if (!messages) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no such session" });
      }
      return { messages };
    }),
    update: signedIn
      .input(sessionUpdate.safeExtend({ id: sessionId }))
      .mutation(({ ctx, input: { id, ...update } }) =>
        updateSession(id, ctx.owner, update),
      ),
    remove: signedIn
      .input(session)
      .mutation(({ ctx, input }) => deleteSession(input.id, ctx.owner)),
    export: signedIn.query(({ ctx }) => exportSessions(ctx.owner)),
    removeAll: signedIn.mutation(({ ctx }) => deleteAllSessions(ctx.owner)),
    feedback: signedIn
      .input(feedbackInput.safeExtend({ id: sessionId }))
      .mutation(async ({ ctx, input: { id, ...feedback } }) => {
        const saved = await setFeedback(id, ctx.owner, feedback);
        track(
          { name: "feedback.given", props: { value: feedback.value } },
          ctx.owner,
        );
        return saved;
      }),
    fork: signedIn
      .input(forkInput.safeExtend({ id: sessionId }))
      .mutation(({ ctx, input: { id, ...fork } }) =>
        forkSession(id, ctx.owner, fork),
      ),
  }),
  settings: t.router({
    get: signedIn.query(({ ctx }) => getSettings(ctx.owner)),
    update: signedIn
      .input(settingsUpdate)
      .mutation(({ ctx, input }) => updateSettings(ctx.owner, input)),
  }),
  suggest: procedure
    .input(z.object({ q: z.string() }))
    .query(({ ctx, input }) => suggestions(input.q.trim(), ctx.user?.id)),
  media: t.router({
    images: signedIn
      .input(z.object({ q: z.string() }))
      .query(({ input }) => imageSearch({ query: input.q })),
    videos: signedIn
      .input(z.object({ q: z.string() }))
      .query(
        async ({ input }) =>
          (await youtubeSearch({ query: input.q, limit: 10 })).videos,
      ),
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
        ...GEMINI_MODELS,
      ].toSorted((a, b) => isDefault(b) - isDefault(a));
    }),
  }),
});

export type AppRouter = typeof appRouter;
