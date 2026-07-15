import { neon } from "@neondatabase/serverless"
import { env } from "@sirathic/env/server"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"

const sql = neon(env.DATABASE_URL)
await migrate(drizzle(sql), { migrationsFolder: `${import.meta.dir}/../drizzle` })

console.log("migrations applied")
