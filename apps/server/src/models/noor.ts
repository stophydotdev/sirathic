import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@sirathic/env/server";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { Model } from "./subscription";

const workersAi = createOpenAI({
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
  apiKey: env.CLOUDFLARE_AI_TOKEN,
});

const leanTools: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    tools: params.tools?.map((tool) => {
      if (tool.type !== "function") return tool;
      const { $schema: _draft, ...inputSchema } = tool.inputSchema;
      return { ...tool, inputSchema };
    }),
  }),
};

const thinkingOff: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    providerOptions: {
      ...params.providerOptions,
      openai: { ...params.providerOptions?.openai, reasoningEffort: "none" },
    },
  }),
};

const NOOR = "sirathic-noor-1-flash";

const deepseek = workersAi.chat("@cf/deepseek-ai/deepseek-v4.1-flash-1017");

const answering = wrapLanguageModel({ model: deepseek, middleware: [leanTools] });

export const NOOR_MODELS: Model[] = [{ slug: NOOR, name: "Noor 1 Flash", maker: "sirathic" }];

export const DEFAULT_NOOR = NOOR;

export const NOOR_SIDE_MODEL = wrapLanguageModel({
  model: deepseek,
  middleware: [leanTools, thinkingOff],
});

export const noorModel = (slug: string) => (slug === NOOR ? answering : undefined);
