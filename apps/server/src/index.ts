import { trpcServer } from "@hono/trpc-server";
import { env } from "@sirathic/env/server";
import { validateUIMessages } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { auth, userFor } from "./auth";
import { startScheduler } from "./automations/runner";
import { countNoorAnswer, pickModels } from "./chat/models";
import { chatResponse } from "./chat/response";
import { chatTitle } from "./chat/title";
import { clientOf } from "./client";
import { connectedTools, finishConnect } from "./connectors/connections";
import { track } from "./events";
import { readProjectFiles } from "./files/attachments";
import { filesRoutes } from "./files/routes";
import { projectOfChat, rememberInProject } from "./projects";
import { projectRules, settingsInProject } from "./projectRules";
import { type ChatMessage, device, mode } from "./shared/messages";
import { parseBody, reasonOf, respond, StatusError } from "./respond";
import { answerOptions, sideOptions } from "./chatgpt/codex";
import { appRouter, createContext } from "./router";
import { getSettings, remember } from "./settings";
import { DEFAULT_SETTINGS } from "./shared/settings";
import { messageSchemas, saveSession, sessionId, titleSession } from "./sessions";
import { skillRules } from "./skills";

const IDLE_TIMEOUT_SECONDS = 255;

const chatBody = z.object({
  id: sessionId,
  messages: z.array(z.unknown()).min(1),
  model: z.string().min(1).optional(),
  mode: mode.default("quick"),
  incognito: z.boolean().default(false),
  projectId: z.uuid().optional().catch(undefined),
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
    const { modelName, models } = pickModels(user, input.model);
    await countNoorAnswer(by, modelName);
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
    const project = projectOfChat(input.id, by, input.projectId).catch((err: Error) => {
      console.error(`project not read: ${reasonOf(err)}`);
      return undefined;
    });
    let saving = Promise.resolve();
    const save = (messages: typeof validated) => {
      if (input.incognito) return saving;
      saving = saving
        .catch(() => undefined)
        .then(async () => saveSession(input.id, by, messages, (await project)?.id));
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
            titleSession(input.id, by, validated, () =>
              chatTitle(models.small, validated, sideOptions),
            ),
          )
          .catch((err: Error) => {
            console.error(`title not set: ${reasonOf(err)}`);
            return undefined;
          });
    return chatResponse({
      models,
      modelName,
      messages: validated,
      mode: input.mode,
      abortSignal: c.req.raw.signal,
      preferences: Promise.all([getSettings(by), project])
        .then(([settings, inProject]) => settingsInProject(settings, inProject))
        .catch((err: Error) => {
          console.error(`settings not read: ${reasonOf(err)}`);
          return DEFAULT_SETTINGS;
        }),
      connected: connectedTools(by),
      projectRules: project.then(async (inProject) =>
        inProject ? projectRules(inProject) + (await readProjectFiles(by, inProject.id)) : "",
      ),
      skillRules:
        owner === undefined
          ? Promise.resolve("")
          : skillRules(
              owner,
              asked?.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ") ?? "",
            ).catch((err: Error) => {
              console.error(`skills not read: ${reasonOf(err)}`);
              return "";
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
      fileOwner: by,
      remember:
        owner === undefined
          ? undefined
          : async (told) => {
              const inProject = await project;
              return inProject?.projectOnlyMemory
                ? rememberInProject(inProject.id, owner, told)
                : remember(owner, told);
            },
    });
  }),
);

app.route("/api/files", filesRoutes);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/connectors/callback", async (c) => {
  const user = await userFor(c.req.raw.headers);
  if (user) {
    await finishConnect(user.id, c.req.query()).catch((err: Error) => {
      console.error(`connector not connected: ${reasonOf(err)}`);
    });
  }
  return c.redirect(new URL("/plugins", env.SITE_URL).href);
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_options, c) => createContext(c.req.raw.headers),
  }),
);

if (env.RAILWAY_ENVIRONMENT_NAME === "production") startScheduler();

export default {
  port: env.PORT,
  idleTimeout: IDLE_TIMEOUT_SECONDS,
  fetch: app.fetch,
};
