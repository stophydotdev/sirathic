import { db } from "@sirathic/db";
import { loginSessions, users } from "@sirathic/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
  type DeviceTokens,
  identityOf,
  refreshDeviceTokens,
} from "./chatgpt/device";
import { StatusError } from "./respond";
import { seal, unseal } from "./vault";

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;
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
  plan: string | null;
  accountId: string;
};

const digest = async (token: string) =>
  Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
  ).toString("hex");

const access = new Map<string, Promise<DeviceTokens>>();

async function saveTokens(userId: string, tokens: DeviceTokens) {
  await db
    .update(users)
    .set({ tokens: await seal(JSON.stringify(tokens)) })
    .where(eq(users.id, userId));
}

async function endEverywhere(userId: string) {
  access.delete(userId);
  await db.delete(loginSessions).where(eq(loginSessions.userId, userId));
  await db.update(users).set({ tokens: null }).where(eq(users.id, userId));
}

export async function signIn(tokens: DeviceTokens) {
  const identity = await identityOf(tokens);
  const profile = {
    email: identity.email ?? null,
    plan: identity.plan ?? null,
    accountId: identity.accountId,
    tokens: await seal(JSON.stringify(tokens)),
  };
  await db
    .insert(users)
    .values({ id: identity.subject, ...profile })
    .onConflictDoUpdate({ target: users.id, set: profile });
  access.delete(identity.subject);
  const token = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString("base64url");
  await db.insert(loginSessions).values({
    id: await digest(token),
    userId: identity.subject,
    expiresAt: new Date(Date.now() + SESSION_DAYS * DAY_MS),
  });
  return token;
}

export async function userFor(token: string | undefined) {
  if (!token) return undefined;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      plan: users.plan,
      accountId: users.accountId,
    })
    .from(loginSessions)
    .innerJoin(users, eq(users.id, loginSessions.userId))
    .where(
      and(
        eq(loginSessions.id, await digest(token)),
        gt(loginSessions.expiresAt, new Date()),
      ),
    );
  return row satisfies User | undefined;
}

export async function signOut(token: string) {
  const [ended] = await db
    .delete(loginSessions)
    .where(eq(loginSessions.id, await digest(token)))
    .returning({ userId: loginSessions.userId });
  if (!ended) return;
  const [other] = await db
    .select({ id: loginSessions.id })
    .from(loginSessions)
    .where(eq(loginSessions.userId, ended.userId))
    .limit(1);
  if (!other) await endEverywhere(ended.userId);
}

async function storedTokensOf(userId: string) {
  const [row] = await db
    .select({ tokens: users.tokens })
    .from(users)
    .where(eq(users.id, userId));
  if (!row?.tokens) {
    throw new StatusError(401, "your ChatGPT sign-in ended, sign in again");
  }
  return storedTokens.parse(JSON.parse(await unseal(row.tokens)));
}

async function renew(userId: string, tokens: DeviceTokens) {
  const result = await refreshDeviceTokens(tokens);
  if (result.status === "ended") {
    await endEverywhere(userId);
    throw new StatusError(401, "your ChatGPT sign-in ended, sign in again");
  }
  await saveTokens(userId, result.tokens);
  return result.tokens;
}

const fresh = (tokens: DeviceTokens) =>
  tokens.expiresAt - RENEW_EARLY_MS > Date.now();

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

export async function accessToken(user: User) {
  const current = access.get(user.id);
  const tokens = await (current ?? load(user.id));
  if (!current || fresh(tokens)) return tokens.accessToken;
  if (access.get(user.id) === current) load(user.id);
  return (await (access.get(user.id) ?? load(user.id))).accessToken;
}
