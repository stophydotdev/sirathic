import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    FIRECRAWL_URL: z.url(),
    OPENROUTER_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().default("openai/gpt-5.4-mini"),
  },
  runtimeEnv: {
    FIRECRAWL_URL: process.env.FIRECRAWL_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL,
  },
  emptyStringAsUndefined: true,
});
