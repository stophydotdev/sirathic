import { initTRPC, TRPCError } from "@trpc/server";
import { userFor } from "./account/auth";
import { track } from "./chat/events";
import { StatusError } from "./http";

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

export const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create();

export const procedure = t.procedure.use(async ({ ctx, next, path }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof StatusError) {
    throw new TRPCError({
      code: TRPC_CODES[result.error.cause.status],
      message: result.error.cause.message,
    });
  }
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    track({ name: "api.failed", props: { route: path, code: result.error.code } }, ctx.user?.id);
  }
  return result;
});

export const signedIn = procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "not signed in",
    });
  }
  return next({ ctx: { user: ctx.user, owner: ctx.user.id } });
});
