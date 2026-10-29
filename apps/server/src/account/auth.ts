import { db } from "@sirathic/db";
import { accounts, loginSessions, users, verifications } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { deviceSignIn } from "./deviceSignIn";
import { clientOf } from "../chat/client";
import { type SignInVia, track } from "../chat/events";
import { forgetIfSignedOut, SESSION_DAYS, type User } from "./users";

const socialProvider = z.enum(["google", "github"]).catch("google");

const socialSignIn = z.object({ provider: socialProvider }).catch({ provider: "google" });

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
  session: {
    expiresIn: SESSION_DAYS * 86_400,
    cookieCache: { enabled: true, maxAge: 300 },
  },
  account: { storeStateStrategy: "cookie", encryptOAuthTokens: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  advanced: {
    cookiePrefix: "sirathic",
    ipAddress: { disableIpTracking: true },
  },
  plugins: [deviceSignIn(), expo()],
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
          via: socialSignIn.parse(ctx.body).provider,
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
          props: {
            step: "completed",
            via: socialProvider.parse(ctx.path.slice("/callback/".length)),
            plan: null,
          },
        },
        created.user.id,
      );
    }),
  },
});

export function toUser({
  id,
  email,
  image,
  plan,
  accountId,
}: {
  id: string;
  email: string | null;
  image?: string | null;
  plan?: string | null;
  accountId?: string | null;
}): User {
  return accountId
    ? { via: "chatgpt", id, email, image: image ?? null, plan: plan ?? null, accountId }
    : { via: "google", id, email, image: image ?? null };
}

export async function signInMethod(user: User): Promise<SignInVia> {
  const linked = await db
    .select({ provider: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  const providers = new Set(linked.map((row) => row.provider));
  if (providers.has("google")) return "google";
  return providers.has("github") ? "github" : user.via;
}

export async function userFor(headers: Headers): Promise<User | undefined> {
  const found = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  return found ? toUser(found.user) : undefined;
}
