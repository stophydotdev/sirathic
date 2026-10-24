import { trpcServer } from "@hono/trpc-server";
import { countUp } from "@sirathic/core/cache";
import { env } from "@sirathic/env/server";
import { validateUIMessages } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { auth, userFor } from "./auth";
import { chatResponse } from "./chat/response";
import { chatTitle } from "./chat/title";
import { clientOf } from "./client";
import { track } from "./events";
import { geminiModel } from "./gemini";
import { DEFAULT_NOOR, NOOR_SIDE_MODEL, noorModel } from "./noor";
import { type ChatMessage, device, mode } from "./shared/messages";
import { parseBody, reasonOf, respond, StatusError } from "./respond";
import { answerOptions, chatModel, DEFAULT_MODEL, sideOptions } from "./chatgpt/codex";
import { appRouter, createContext } from "./router";
import { getSettings, remember } from "./settings";
import { DEFAULT_SETTINGS } from "./shared/settings";
import { messageSchemas, saveSession, sessionId, titleSession } from "./sessions";

const IDLE_TIMEOUT_SECONDS = 255;
const NOOR_DAILY_ANSWERS = 30;
const NOOR_COUNT_KEEP_SECONDS = 2 * 24 * 60 * 60;

const chatBody = z.object({
  id: sessionId,
  messages: z.array(z.unknown()).min(1),
  model: z.string().min(1).optional(),
  mode: mode.default("quick"),
  incognito: z.boolean().default(false),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional().catch(undefined),
  device: device.optional().catch(undefined),
  language: z
    .string()
    .regex(/^[a-z]{2,3}$/u)
    .optional()
    .catch(undefined),
});

const app = new Hono();

app.use(async (c, next) => {
  const started = performance.now();
  await next();
  const ms = Math.round(performance.now() - started);
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

app.get("/", (c) => c.text("OK"));

app.post("/api/chat", (c) =>
  respond(async () => {
    const input = await parseBody(c.req.raw, chatBody);
    const user = await userFor(c.req.raw.headers);
    if (!user) throw new StatusError(401, "not signed in");
    const by = user.id;
    const validated = await validateUIMessages<ChatMessage>({
      messages: input.messages,
      ...messageSchemas,
    }).catch((err: Error) => {
      throw new StatusError(400, err.message);
    });
    const owner = input.incognito ? undefined : by;
    const modelName = input.model ?? (user.via === "chatgpt" ? DEFAULT_MODEL : DEFAULT_NOOR);
    const chosen =
      modelName &&
      (noorModel(modelName) ??
        geminiModel(modelName) ??
        (user.via === "chatgpt" ? chatModel(user, modelName) : undefined));
    const small = user.via === "chatgpt" ? chatModel(user) : NOOR_SIDE_MODEL;
    if (!modelName || !chosen || !small) {
      throw new StatusError(403, "sign in with ChatGPT to use this model");
    }
    if (noorModel(modelName)) {
      const day = new Date().toISOString().slice(0, 10);
      const used = await countUp(`noor-answers:${by}:${day}`, NOOR_COUNT_KEEP_SECONDS).catch(
        (err: Error) => {
          console.error(`noor answers not counted: ${reasonOf(err)}`);
          return 0;
        },
      );
      if (used > NOOR_DAILY_ANSWERS) {
        throw new StatusError(
          429,
          `You've used today's ${NOOR_DAILY_ANSWERS} Noor answers. They come back tomorrow.`,
        );
      }
    }
    const asked = validated.findLast((message) => message.role === "user");
    track(
      {
        name: "answer.requested",
        props: {
          mode: input.mode,
          model: modelName,
          turn: validated.filter((message) => message.role === "user").length,
          regenerate: input.trigger === "regenerate-message",
          incognito: input.incognito,
          files: asked?.parts.filter((part) => part.type === "file").length ?? 0,
          device: input.device,
          language: input.language,
          ...clientOf(c.req.raw.headers),
        },
      },
      owner,
    );
    let saving = Promise.resolve();
    const save = (messages: typeof validated) => {
      if (input.incognito) return saving;
      saving = saving.catch(() => undefined).then(() => saveSession(input.id, by, messages));
      return saving;
    };
    const saved = save(validated);
    saved.catch((err: Error) => {
      console.error(`session not saved: ${reasonOf(err)}`);
    });
    const title = input.incognito
      ? undefined
      : saved
          .then(() =>
            titleSession(input.id, by, validated, () => chatTitle(small, validated, sideOptions)),
          )
          .catch((err: Error) => {
            console.error(`title not set: ${reasonOf(err)}`);
            return undefined;
          });
    return chatResponse({
      models: { model: chosen, small },
      modelName,
      messages: validated,
      mode: input.mode,
      abortSignal: c.req.raw.signal,
      preferences: getSettings(by).catch((err: Error) => {
        console.error(`settings not read: ${reasonOf(err)}`);
        return DEFAULT_SETTINGS;
      }),
      options: {
        answer: answerOptions({
          research: input.mode === "research",
          sessionId: input.id,
        }),
        side: sideOptions,
      },
      title,
      save,
      record: (event) => track(event, owner),
      remember: owner === undefined ? undefined : (told) => remember(owner, told),
    });
  }),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_options, c) => createContext(c.req.raw.headers),
  }),
);

export default {
  port: env.PORT,
  idleTimeout: IDLE_TIMEOUT_SECONDS,
  fetch: app.fetch,
};
