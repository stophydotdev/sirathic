import { neon } from "@neondatabase/serverless"
import { env } from "@sirathic/env/server"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

export function createDb(connectionString = env.DATABASE_URL) {
  return drizzle(neon(connectionString), { schema })
}

export type Db = ReturnType<typeof createDb>
