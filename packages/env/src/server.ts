import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    OPENAI_API_KEY: z.string().optional(),
    STOPHY_API_KEY: z.string().optional(),
    TOKEN_KEY: z
      .base64()
      .refine((key) => Buffer.from(key, "base64").length === 32, {
        message: "TOKEN_KEY must be 32 random bytes in base64",
      })
      .optional(),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
