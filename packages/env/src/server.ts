import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    OPENAI_API_KEY: z.string(),
    STOPHY_API_KEY: z.string(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    TAMYIZ_DIR: z.string().optional(),
    SITE_URL: z.url().default("https://sirathic.com"),
    BETTER_AUTH_SECRET: z.string().min(32),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
