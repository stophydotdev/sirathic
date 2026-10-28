import { createAnthropic } from "@ai-sdk/anthropic";
import { env } from "@sirathic/env/server";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { Model } from "./subscription";

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CACHED_HOUR = { anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } };
const CACHED = { anthropic: { cacheControl: { type: "ephemeral" } } };

const cacheMarks: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const asked = params.prompt.findLastIndex((message) => message.role === "user");
    const latest = params.prompt.findLastIndex((message) => message.role !== "system");
    const oneShot =
      !params.tools?.length &&
      params.prompt.every((message, index) => message.role === "system" || index === asked);
    const markOf = (role: string, index: number) =>
      index === 0 && role === "system"
        ? CACHED_HOUR
        : oneShot
          ? undefined
          : index === asked
            ? CACHED_HOUR
            : index === latest
              ? CACHED
              : undefined;
    return {
      ...params,
      tools: params.tools?.map((tool, index, all) =>
        index === all.length - 1 && tool.type === "function"
          ? { ...tool, providerOptions: { ...tool.providerOptions, ...CACHED_HOUR } }
          : tool,
      ),
      prompt: params.prompt.map((message, index) => {
        const mark = markOf(message.role, index);
        return mark
          ? { ...message, providerOptions: { ...message.providerOptions, ...mark } }
          : message;
      }),
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
