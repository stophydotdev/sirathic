import { env } from "@sirathic/env/server"
import {
  ask as answerQuestion,
  askWithEvents as answerQuestionWithEvents,
  type AskEventEmitter,
  type AskOptions,
  type AskResult,
  type ResearchMode,
  type ResearchSource,
} from "@sirathic/core"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { secureHeaders } from "hono/secure-headers"
import { streamSSE } from "hono/streaming"

const publicAsset = (name: string) => Bun.file(new URL(`../public/${name}`, import.meta.url))

export interface AppDependencies {
  ask?: (question: string, options?: AskOptions) => Promise<AskResult>
  askEvents?: (question: string, options: AskOptions, emit: AskEventEmitter) => Promise<AskResult>
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono()
  const ask = dependencies.ask ?? answerQuestion
  const askEvents = dependencies.askEvents ?? answerQuestionWithEvents

  app.use("/*", secureHeaders())
  app.use(
    "/*",
    cors({
      origin: env.CORS_ORIGIN,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  )

  app.get("/", async (c) => c.html(await publicAsset("index.html").text()))
  app.get("/app.css", async (c) => c.body(await publicAsset("app.css").text(), 200, { "Content-Type": "text/css; charset=UTF-8" }))
  app.get("/app.js", async (c) => c.body(await publicAsset("app.js").text(), 200, { "Content-Type": "text/javascript; charset=UTF-8" }))
  app.get("/healthz", (c) => c.json({ ok: true }))

  app.post("/v1/ask", async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } }, 400)
    }

    const question = typeof body === "object" && body !== null && "question" in body ? body.question : undefined
    if (typeof question !== "string" || !question.trim()) {
      return c.json({ error: { code: "INVALID_REQUEST", message: "question must be a non-empty string." } }, 400)
    }

    const requestedMode = typeof body === "object" && body !== null && "mode" in body ? body.mode : undefined
    const mode: ResearchMode = requestedMode === "speed" || requestedMode === "quality" ? requestedMode : "balanced"
    const requestedSources = typeof body === "object" && body !== null && "sources" in body ? body.sources : undefined
    const allowedSources = new Set<ResearchSource>(["quran", "hadith", "web"])
    const sources = Array.isArray(requestedSources)
      ? requestedSources.filter((source): source is ResearchSource => typeof source === "string" && allowedSources.has(source as ResearchSource))
      : undefined
    const options: AskOptions = { mode, sources: sources?.length ? sources : undefined }
    const requestedStream = typeof body === "object" && body !== null && "stream" in body && body.stream === true
    const wantsStream = requestedStream || c.req.header("accept")?.includes("text/event-stream")

    if (wantsStream) {
      return streamSSE(c, async (stream) => {
        try {
          await askEvents(question.trim(), options, async (event) => {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
          })
        } catch {
          // askEvents emits a typed error event before rejecting.
        }
      })
    }

    return c.json(await ask(question.trim(), options))
  })

  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404))
  app.onError((error, c) => {
    console.error(error)
    return c.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, 500)
  })

  return app
}

export type ServerApp = ReturnType<typeof createApp>
