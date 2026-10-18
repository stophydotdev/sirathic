import { env } from "@sirathic/env/server";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema.ts",
  casing: "snake_case",
  dbCredentials: { url: env.DATABASE_URL },
});
