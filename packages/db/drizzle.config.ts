import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"

dotenv.config({
  path: "../../apps/server/.env",
  quiet: true,
})

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
