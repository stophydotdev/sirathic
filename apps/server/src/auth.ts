import { db } from "@sirathic/db";
import {
  accounts,
  loginSessions,
  users,
  verifications,
} from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { chatgptSignIn } from "./chatgpt/sign-in";
import { clientOf } from "./client";
import { track } from "./events";
import { forgetIfSignedOut, SESSION_DAYS, type User } from "./users";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
        },
      }
    : undefined;

const APP_ORIGINS = env.SITE_URL.startsWith("http://")
  ? ["sirathic://", "exp://**"]
  : ["sirathic://"];

export const auth = betterAuth({
  baseURL: env.SITE_URL,
  trustedOrigins: APP_ORIGINS,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: loginSessions,
      account: accounts,
      verification: verifications,
    },
  }),
  user: {
    additionalFields: {
      plan: { type: "string", required: false, input: false },
      accountId: { type: "string", required: false, input: false },
    },
  },
  session: { expiresIn: SESSION_DAYS * 86_400 },
  account: { storeStateStrategy: "cookie", encryptOAuthTokens: true },
  socialProviders: google,
  advanced: {
    cookiePrefix: "sirathic",
    ipAddress: { disableIpTracking: true },
  },
  plugins: [chatgptSignIn(), expo()],
  databaseHooks: {
    session: {
      delete: { after: (session) => forgetIfSignedOut(session.userId) },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/social") return;
      track({
        name: "signin",
        props: {
          step: "started",
          via: "google",
          ...clientOf(ctx.headers ?? new Headers()),
        },
      });
    }),
    after: createAuthMiddleware(async (ctx) => {
      const created = ctx.context.newSession;
      if (!ctx.path.startsWith("/callback/") || !created) return;
      track(
        {
          name: "signin",
          props: { step: "completed", via: "google", plan: null },
        },
        created.user.id,
      );
    }),
  },
});

export async function userFor(headers: Headers): Promise<User | undefined> {
  const found = await auth.api.getSession({ headers });
  if (!found) return undefined;
  const { id, email, plan, accountId } = found.user;
  const image = found.user.image ?? null;
  return accountId
    ? { via: "chatgpt", id, email, image, plan: plan ?? null, accountId }
    : { via: "google", id, email, image };
}
