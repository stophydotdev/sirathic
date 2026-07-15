import { env } from "@sirathic/env/server"
import { createApp } from "./app"

const app = createApp()

Bun.serve({
  port: env.PORT,
  idleTimeout: 255,
  fetch: app.fetch,
})

console.log(`server listening on :${env.PORT}`)
