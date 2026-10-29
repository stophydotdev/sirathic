import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { db } from "@sirathic/db";
import { accounts } from "@sirathic/db/schema";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { DEVICE_PAGE, pollDeviceLogin, startDeviceLogin } from "../account/deviceLogin";
import { PLAN_LOGINS, planLogin, type PlanLogin, type PlanTokens } from "../account/planLogin";
import { connectChatgpt, forgetSubscription, type User } from "../account/users";
import { seal, unseal } from "../account/vault";
import type { Model, ProviderOptions } from "./subscription";

const TOKEN_PLANS = ["minimax", "xai"] as const;

const tokenPlan = z.enum(TOKEN_PLANS);

type TokenPlan = z.infer<typeof tokenPlan>;

export const plan = z.enum(["chatgpt", ...TOKEN_PLANS]);

type Plan = z.infer<typeof plan>;

const PLAN_NAMES = { minimax: "MiniMax", xai: "Grok" } satisfies Record<TokenPlan, string>;

const PLAN_MODELS = {
  minimax: [{ slug: "MiniMax-M2.7", name: "MiniMax M2.7", maker: "minimax" }],
  xai: [{ slug: "grok-4.3", name: "Grok 4.3", maker: "xai" }],
} satisfies Record<TokenPlan, Model[]>;

const ticket = planLogin.extend({ plan, owner: z.string() });

const RENEW_EARLY_MS = 5 * 60_000;

const access = new Map<string, Promise<PlanTokens>>();

const keyOf = (userId: string, id: TokenPlan) => `${id}:${userId}`;

const fresh = (tokens: PlanTokens) => tokens.expiresAt - RENEW_EARLY_MS > Date.now();

const ended = (id: TokenPlan) =>
  new StatusError(401, `your ${PLAN_NAMES[id]} sign-in ended, connect it again`);

async function store(userId: string, id: TokenPlan, tokens: PlanTokens) {
  const sealed = {
    accessToken: await seal(tokens.accessToken),
    refreshToken: await seal(tokens.refreshToken),
    accessTokenExpiresAt: new Date(tokens.expiresAt),
  };
  await db
    .insert(accounts)
    .values({ id: keyOf(userId, id), userId, providerId: id, accountId: userId, ...sealed })
    .onConflictDoUpdate({ target: accounts.id, set: sealed });
}

async function forget(userId: string, id: TokenPlan) {
  access.delete(keyOf(userId, id));
  await db.delete(accounts).where(eq(accounts.id, keyOf(userId, id)));
}

async function storedTokens(userId: string, id: TokenPlan): Promise<PlanTokens> {
  const [row] = await db
    .select({
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      expiresAt: accounts.accessTokenExpiresAt,
    })
    .from(accounts)
    .where(eq(accounts.id, keyOf(userId, id)));
  if (!row?.accessToken || !row.refreshToken || !row.expiresAt) throw ended(id);
  return {
    accessToken: await unseal(row.accessToken),
    refreshToken: await unseal(row.refreshToken),
    expiresAt: row.expiresAt.getTime(),
  };
}

async function renew(userId: string, id: TokenPlan, tokens: PlanTokens) {
  const result = await PLAN_LOGINS[id].refresh(tokens);
  if (result.status === "ended") {
    await forget(userId, id);
    throw ended(id);
  }
  await store(userId, id, result.tokens);
  return result.tokens;
}

function load(userId: string, id: TokenPlan) {
  const key = keyOf(userId, id);
  const loading = storedTokens(userId, id).then((stored) =>
    fresh(stored) ? stored : renew(userId, id, stored),
  );
  access.set(key, loading);
  loading.catch(() => {
    if (access.get(key) === loading) access.delete(key);
  });
  return loading;
}

async function accessToken(userId: string, id: TokenPlan) {
  const key = keyOf(userId, id);
  const current = access.get(key);
  const tokens = await (current ?? load(userId, id));
  if (!current || fresh(tokens)) return tokens.accessToken;
  if (access.get(key) === current) load(userId, id);
  return (await (access.get(key) ?? load(userId, id))).accessToken;
}

const TOKEN_HEADER = {
  minimax: (token: string) => ["x-api-key", token],
  xai: (token: string) => ["authorization", `Bearer ${token}`],
} satisfies Record<TokenPlan, (token: string) => [string, string]>;

const withToken = (userId: string, id: TokenPlan) =>
  Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set(...TOKEN_HEADER[id](await accessToken(userId, id)));
      return fetch(input, { ...init, headers });
    },
    { preconnect: fetch.preconnect },
  );

const onlyOptions = (providerOptions: ProviderOptions): LanguageModelMiddleware => ({
  transformParams: async ({ params }) => ({ ...params, providerOptions }),
});

const MODEL_OF = {
  minimax: (userId: string, slug: string) =>
    wrapLanguageModel({
      model: createAnthropic({
        name: "minimax",
        baseURL: "https://api.minimax.io/anthropic/v1",
        apiKey: "plan",
        fetch: withToken(userId, "minimax"),
      })(slug),
      middleware: onlyOptions({}),
    }),
  xai: (userId: string, slug: string) =>
    wrapLanguageModel({
      model: createOpenAI({
        name: "xai",
        apiKey: "plan",
        baseURL: "https://api.x.ai/v1",
        fetch: withToken(userId, "xai"),
      }).responses(slug),
      middleware: onlyOptions({
        openai: {
          store: false,
          include: ["reasoning.encrypted_content"],
        } satisfies OpenAILanguageModelResponsesOptions,
      }),
    }),
};

export function planModel(userId: string, slug: string) {
  const id = TOKEN_PLANS.find((each) => PLAN_MODELS[each].some((model) => model.slug === slug));
  return id && MODEL_OF[id](userId, slug);
}

export async function connectedPlans(user: User): Promise<Plan[]> {
  const rows = await db
    .select({ id: accounts.providerId })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), inArray(accounts.providerId, TOKEN_PLANS)));
  const chatgpt: Plan[] = user.via === "chatgpt" ? ["chatgpt"] : [];
  return [...chatgpt, ...rows.map((row) => tokenPlan.parse(row.id))];
}

export const planModels = (plans: Plan[]) =>
  plans.flatMap<Model>((id) => (id === "chatgpt" ? [] : PLAN_MODELS[id]));

async function startLogin(id: Plan): Promise<PlanLogin> {
  if (id !== "chatgpt") return PLAN_LOGINS[id].start();
  const login = await startDeviceLogin();
  return { ...login, verificationUrl: DEVICE_PAGE, secret: login.deviceAuthId };
}

export async function startPlan(owner: string, id: Plan) {
  const login = await startLogin(id);
  return {
    userCode: login.userCode,
    verificationUrl: login.verificationUrl,
    intervalMs: login.intervalMs,
    ticket: await seal(JSON.stringify({ ...login, plan: id, owner })),
  };
}

export async function pollPlan(
  owner: string,
  sealed: string,
): Promise<"pending" | "expired" | "connected"> {
  const login = ticket.safeParse(JSON.parse(await unseal(sealed).catch(() => "null"))).data;
  if (!login || Date.now() > login.expiresAt) return "expired";
  if (login.owner !== owner) throw new StatusError(403, "this sign-in belongs to another account");
  if (login.plan === "chatgpt") {
    const polled = await pollDeviceLogin({ ...login, deviceAuthId: login.secret });
    if (polled.status !== "signed-in") return polled.status;
    await connectChatgpt(owner, polled.tokens);
    return "connected";
  }
  const polled = await PLAN_LOGINS[login.plan].poll(login);
  if (polled.status !== "approved") return polled.status;
  await store(owner, login.plan, polled.tokens);
  access.delete(keyOf(owner, login.plan));
  return "connected";
}

export const disconnectPlan = (owner: string, id: Plan) =>
  id === "chatgpt" ? forgetSubscription(owner) : forget(owner, id);
