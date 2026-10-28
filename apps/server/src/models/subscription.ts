import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { streamText } from "ai";
import { cacheFor } from "@sirathic/core/cache";
import { z } from "zod";
import { StatusError } from "../http";
import { accessToken, type SubscriptionUser } from "../account/users";
import { CODEX_API, codexFetch } from "../account/deviceLogin";
import type { Effort } from "../shared/messages";

export const DEFAULT_MODEL = "gpt-6-luna";

export type ProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

const listedModel = z.object({
  slug: z.string(),
  name: z.string(),
  maker: z.enum(["sirathic", "openai", "anthropic", "deepseek", "zhipu", "qwen", "xiaomi"]),
});

export type Model = z.infer<typeof listedModel>;

const HOUR_MS = 3_600_000;

const chatgptModels = cacheFor({
  namespace: "chatgpt-models:v1",
  schema: z.array(listedModel),
  freshMs: HOUR_MS,
  keepMs: 24 * HOUR_MS,
});

const modelsResponse = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      display_name: z.string().optional(),
      visibility: z.string().optional(),
    }),
  ),
});

const codexFor = (user: SubscriptionUser) =>
  codexFetch(async () => ({
    accessToken: await accessToken(user),
    accountId: user.accountId,
  }));

export const chatModel = (user: SubscriptionUser, slug = DEFAULT_MODEL) =>
  createOpenAI({
    apiKey: "codex",
    baseURL: CODEX_API,
    fetch: codexFor(user),
  }).responses(slug);

export const models = (user: SubscriptionUser) => chatgptModels(user.id, () => listModels(user));

async function listModels(user: SubscriptionUser): Promise<Model[]> {
  const res = await codexFor(user)("models");
  if (!res.ok) {
    throw new StatusError(
      res.status === 401 || res.status === 403 ? res.status : 502,
      `ChatGPT models answered ${res.status}`,
    );
  }
  return modelsResponse
    .parse(await res.json())
    .models.filter((model) => (model.visibility ?? "list") === "list")
    .map((model) => ({
      slug: model.slug,
      name: model.display_name ?? model.slug,
      maker: "openai",
    }));
}

export const answerOptions = (turn: { effort: Effort; sessionId: string }): ProviderOptions => ({
  openai: {
    store: false,
    include: ["reasoning.encrypted_content"],
    forceReasoning: true,
    reasoningEffort: turn.effort,
    promptCacheKey: turn.sessionId,
    textVerbosity: "low",
  } satisfies OpenAILanguageModelResponsesOptions,
  anthropic: {
    effort: turn.effort,
    thinking: { type: "adaptive", display: "summarized" },
  } satisfies AnthropicLanguageModelOptions,
});

export const sideOptions: ProviderOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
  } satisfies OpenAILanguageModelResponsesOptions,
};
