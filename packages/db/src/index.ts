import { env } from "@sirathic/env/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const db = drizzle(postgres(env.DATABASE_URL), {
  casing: "snake_case",
});
