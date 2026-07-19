import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    FIRECRAWL_URL: z.url(),
    OPENROUTER_API_KEY: z.string().optional(),
    STOPHY_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().default("openai/gpt-5.4-mini"),
    CORS_ORIGIN: z.string().default("*"),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
