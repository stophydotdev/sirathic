import { db } from "@sirathic/db";
import { loginSessions, users } from "@sirathic/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { type DeviceTokens, identityOf, refreshDeviceTokens } from "./chatgpt/device";
import { track } from "./events";
import { StatusError } from "./respond";
import { seal, unseal } from "./vault";

export const SESSION_DAYS = 30;
const RENEW_EARLY_MS = 5 * 60_000;

const storedTokens = z.object({
  idToken: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export type User = {
  id: string;
  email: string | null;
  image: string | null;
} & ({ via: "chatgpt"; plan: string | null; accountId: string } | { via: "google" });

export type ChatGPTUser = Extract<User, { via: "chatgpt" }>;

const access = new Map<string, Promise<DeviceTokens>>();

async function saveTokens(userId: string, tokens: DeviceTokens) {
  await db
    .update(users)
    .set({ tokens: await seal(JSON.stringify(tokens)) })
    .where(eq(users.id, userId));
}

async function forgetChatGPT(userId: string) {
  access.delete(userId);
  await db
    .update(users)
    .set({ tokens: null, accountId: null, plan: null })
    .where(eq(users.id, userId));
}

export async function signIn(tokens: DeviceTokens) {
  const identity = await identityOf(tokens);
  const [owner] = identity.email
    ? await db.select({ id: users.id }).from(users).where(eq(users.email, identity.email))
    : [];
  const id =
    owner && (owner.id === identity.subject || identity.emailVerified)
      ? owner.id
      : identity.subject;
  const email = owner && owner.id !== id ? null : (identity.email ?? null);
  const profile = {
    plan: identity.plan ?? null,
    accountId: identity.accountId,
    tokens: await seal(JSON.stringify(tokens)),
  };
  await db
    .insert(users)
    .values({ id, email, emailVerified: identity.emailVerified, ...profile })
    .onConflictDoUpdate({ target: users.id, set: profile });
  access.delete(id);
  track(
    {
      name: "signin",
      props: { step: "completed", via: "chatgpt", plan: profile.plan },
    },
    id,
  );
  return id;
}

export async function forgetIfSignedOut(userId: string) {
  const [other] = await db
    .select({ id: loginSessions.id })
    .from(loginSessions)
    .where(eq(loginSessions.userId, userId))
    .limit(1);
  if (!other) await forgetChatGPT(userId);
}

async function storedTokensOf(userId: string) {
  const [row] = await db.select({ tokens: users.tokens }).from(users).where(eq(users.id, userId));
  if (!row?.tokens) {
    throw new StatusError(401, "your ChatGPT sign-in ended, sign in again");
  }
  return storedTokens.parse(JSON.parse(await unseal(row.tokens)));
}

async function renew(userId: string, tokens: DeviceTokens) {
  const result = await refreshDeviceTokens(tokens);
  if (result.status === "ended") {
    await forgetChatGPT(userId);
    throw new StatusError(401, "your ChatGPT sign-in ended, sign in again");
  }
  await saveTokens(userId, result.tokens);
  return result.tokens;
}

const fresh = (tokens: DeviceTokens) => tokens.expiresAt - RENEW_EARLY_MS > Date.now();

function load(userId: string) {
  const loading = storedTokensOf(userId).then((stored) =>
    fresh(stored) ? stored : renew(userId, stored),
  );
  access.set(userId, loading);
  loading.catch(() => {
    if (access.get(userId) === loading) access.delete(userId);
  });
  return loading;
}

export async function accessToken(user: ChatGPTUser) {
  const current = access.get(user.id);
  const tokens = await (current ?? load(user.id));
  if (!current || fresh(tokens)) return tokens.accessToken;
  if (access.get(user.id) === current) load(user.id);
  return (await (access.get(user.id) ?? load(user.id))).accessToken;
}
