import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "@sirathic/env/server";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { Model } from "./chatgpt/codex";

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CACHED = { anthropic: { cacheControl: { type: "ephemeral" } } };

const cacheMarks: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const beforeRules = params.prompt.findLastIndex((message) => message.role !== "system");
    return {
      ...params,
      prompt: params.prompt.map((message, index) =>
        index === 0 || index === beforeRules
          ? {
              ...message,
              providerOptions: { ...message.providerOptions, ...CACHED },
            }
          : message,
      ),
    };
  },
};

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

const NOOR = "sirathic-noor-1-flash";

const haiku = wrapLanguageModel({
  model: anthropic("claude-haiku-5-5"),
  middleware: [cacheMarks, leanTools],
});

export const NOOR_MODELS: Model[] = [{ slug: NOOR, name: "Noor 1 Flash", maker: "sirathic" }];

export const DEFAULT_NOOR = NOOR;

export const NOOR_SIDE_MODEL = haiku;

export const noorModel = (slug: string) => (slug === NOOR ? haiku : undefined);
