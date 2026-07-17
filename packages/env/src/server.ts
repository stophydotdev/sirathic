import "dotenv/config"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    CORS_ORIGIN: z.string().min(1).default("*"),
    AI_PROVIDER: z.enum(["openai", "openrouter"]).default("openai"),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_MODEL: z.literal("gpt-4o-mini").default("gpt-4o-mini"),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.literal("deepseek/deepseek-v4-flash").default("deepseek/deepseek-v4-flash"),
    FIRECRAWL_URL: z.url().default("http://firecrawl-api.railway.internal:3002"),
    FIRECRAWL_API_KEY: z.string().min(1).optional(),
    REDIS_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
