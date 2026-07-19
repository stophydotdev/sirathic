import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { env } from "@sirathic/env/server";
import { createContext } from "@sirathic/api/context";
import { appRouter } from "@sirathic/api/routers/index";
import SearchAgent from "@sirathic/core/agents/search";
import SessionManager from "@sirathic/core/session";
import { getLLM } from "@sirathic/core/models";
import type { ChatTurnMessage } from "@sirathic/core/types";
import { streamSession } from "./stream";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

const chatBodySchema = z.object({
  message: z.object({
    content: z.string().min(1, "Message content is required"),
  }),
  optimizationMode: z
    .enum(["speed", "balanced", "quality"])
    .default("balanced"),
  sources: z
    .array(z.enum(["web", "youtube"]))
    .optional()
    .default(["web", "youtube"]),
  history: z
    .array(z.tuple([z.enum(["human", "assistant"]), z.string()]))
    .optional()
    .default([]),
  model: z.string().optional(),
  systemInstructions: z.string().nullable().optional().default(""),
});

app.post("/chat", async (c) => {
  const parseBody = chatBodySchema.safeParse(await c.req.json());

  if (!parseBody.success) {
    return c.json(
      {
        message: "Invalid request body",
        error: parseBody.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      400,
    );
  }

  const body = parseBody.data;

  const history: ChatTurnMessage[] = body.history.map(([role, content]) => ({
    role: role === "human" ? "user" : "assistant",
    content,
  }));

  const llm = getLLM(body.model);

  const agent = new SearchAgent();
  const session = SessionManager.createSession();

  agent.searchAsync(session, {
    chatHistory: history,
    followUp: body.message.content,
    config: {
      llm,
      mode: body.optimizationMode,
      sources: body.sources,
      systemInstructions: body.systemInstructions || "None",
    },
  });

  return streamSession(session, c.req.raw.signal, {
    type: "session",
    sessionId: session.id,
  });
});

app.post("/reconnect/:id", (c) => {
  const session = SessionManager.getSession(c.req.param("id"));

  if (!session) {
    return c.json({ message: "Session not found" }, 404);
  }

  return streamSession(session, c.req.raw.signal);
});

app.get("/", (c) => {
  return c.text("OK");
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
