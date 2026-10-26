import type { AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { streamText } from "ai";
import { z } from "zod";
import { StatusError } from "../respond";
import { accessToken, type ChatGPTUser } from "../users";
import { CODEX_API, codexFetch } from "./device";

export const DEFAULT_MODEL = "gpt-6-luna";

export type ProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

export type Model = {
  slug: string;
  name: string;
  maker: "sirathic" | "openai" | "anthropic" | "deepseek" | "zhipu" | "qwen" | "xiaomi";
};

const modelsResponse = z.object({
  models: z.array(
    z.object({
      slug: z.string(),
      display_name: z.string().optional(),
      visibility: z.string().optional(),
    }),
  ),
});

const codexFor = (user: ChatGPTUser) =>
  codexFetch(async () => ({
    accessToken: await accessToken(user),
    accountId: user.accountId,
  }));

export const chatModel = (user: ChatGPTUser, slug = DEFAULT_MODEL) =>
  createOpenAI({
    apiKey: "codex",
    baseURL: CODEX_API,
    fetch: codexFor(user),
  }).responses(slug);

export async function models(user: ChatGPTUser): Promise<Model[]> {
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

export const answerOptions = (turn: { research: boolean; sessionId: string }): ProviderOptions => ({
  openai: {
    store: false,
    include: ["reasoning.encrypted_content"],
    forceReasoning: true,
    reasoningEffort: turn.research ? "high" : undefined,
    promptCacheKey: turn.sessionId,
    textVerbosity: "low",
  } satisfies OpenAILanguageModelResponsesOptions,
  anthropic: {
    effort: turn.research ? "high" : undefined,
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
