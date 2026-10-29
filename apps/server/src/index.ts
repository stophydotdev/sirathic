import { trpcServer } from "@hono/trpc-server";
import { env } from "@sirathic/env/server";
import { UI_MESSAGE_STREAM_HEADERS, validateUIMessages } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { auth, userFor } from "./account/auth";
import { startScheduler } from "./automations/runner";
import { timezone } from "./shared/settings";
import { followAnswer, startAnswer } from "./chat/answers";
import { keepAlive } from "./chat/keepAlive";
import { refreshSummary } from "./bots/summary";
import { pickModels } from "./models/pick";
import { checkNoorUsage, spendNoor } from "./models/usage";
import { chatResponse, KEEPALIVE_MS } from "./chat/response";
import { reviewEvery } from "./bots/review";
import { chatTitle } from "./chat/title";
import { clientOf } from "./chat/client";
import { connectedTools, finishConnect } from "./plugins/connections";
import { track } from "./chat/events";
import { cardDecisions } from "./chat/confirm";
import { uploadRoutes } from "./files/upload";
import { projectOfChat } from "./projects/projects";
import {
  appLanguage,
  type ChatMessage,
  DEFAULT_EFFORT,
  device,
  effort,
  mode,
  sentMessage,
} from "./shared/messages";
import { parseBody, reasonOf, respond, StatusError } from "./http";
import { sideOptions } from "./models/subscription";
import { appRouter } from "./router";
import { createContext } from "./trpc";
import { getSettings } from "./account/settings";
import { DEFAULT_SETTINGS } from "./shared/settings";
import { messageSchemas, saveSession, sessionId, titleSession } from "./chat/sessions";
import { listSkills } from "./skills/skills";
import { sourceKind } from "./shared/sources";

const IDLE_TIMEOUT_SECONDS = 255;

const chatBody = z.object({
  id: sessionId,
  messages: z.array(sentMessage).min(1),
  model: z.string().min(1).optional(),
  mode: mode.default("quick"),
  effort: effort.optional().catch(undefined),
  incognito: z.boolean().default(false),
  projectId: z.uuid().optional().catch(undefined),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional().catch(undefined),
  device: device.optional().catch(undefined),
  timezone: timezone.optional().catch(undefined),
  language: appLanguage.optional().catch(undefined),
  sources: z.array(sourceKind).min(1).optional().catch(undefined),
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
    await checkNoorUsage({
      by,
      modelName,
      timeZone: input.timezone,
      offerGpt: user.via !== "chatgpt",
    });
    const asked = validated.findLast((message) => message.role === "user");
    const regenerate = input.trigger === "regenerate-message";
    const project = projectOfChat(input.id, by, input.projectId).catch((err: Error) => {
      console.error(`project not read: ${reasonOf(err)}`);
      return undefined;
    });
    void project.then((inProject) =>
      track(
        {
          name: "answer.requested",
          props: {
            mode: input.mode,
            model: modelName,
            turn: validated.filter((message) => message.role === "user").length,
            regenerate,
            incognito: input.incognito,
            files: asked?.parts.filter((part) => part.type === "file").length ?? 0,
            device: input.device,
            language: input.language,
            from: inProject?.kind === "bot" ? "bot" : "chat",
            ...clientOf(c.req.raw.headers),
          },
        },
        owner,
      ),
    );
    if (!regenerate) for (const decided of cardDecisions(validated)) track(decided, owner);
    let saving = Promise.resolve();
    const save = (messages: typeof validated) => {
      if (input.incognito) return saving;
      saving = saving
        .catch(() => undefined)
        .then(async () => {
          const inProject = await project;
          await saveSession(input.id, by, messages, inProject?.id);
          if (inProject?.kind === "bot" && messages.at(-1)?.role === "assistant") {
            void refreshSummary({
              bot: { id: inProject.id, owner: by },
              messages,
              model: models.small,
              providerOptions: sideOptions,
            });
          }
        });
      return saving;
    };
    const learn = (messages: typeof validated) => {
      if (owner === undefined || messages.at(-1)?.role !== "assistant") return;
      void project.then(
        (inProject) =>
          inProject?.kind === "bot" && reviewEvery({ user, botId: inProject.id, messages }),
      );
    };
    const userSkills =
      owner === undefined
        ? Promise.resolve([])
        : listSkills(owner).catch((err: Error) => {
            console.error(`skills not read: ${reasonOf(err)}`);
            return [];
          });
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
    const answer = startAnswer(by, input.id, {
      continuing: validated.at(-1)?.role === "assistant",
    });
    return chatResponse({
      models,
      modelName,
      messages: validated,
      mode: input.mode,
      abortSignal: answer.signal,
      consumeSseStream: answer.consumeSseStream,
      spend: spendNoor(by, modelName),
      bot:
        owner === undefined
          ? undefined
          : project.then((inProject) =>
              inProject?.kind === "bot" ? { id: inProject.id, owner } : undefined,
            ),
      preferences: getSettings(by).catch((err: Error) => {
        console.error(`settings not read: ${reasonOf(err)}`);
        return DEFAULT_SETTINGS;
      }),
      connected: project.then((inProject) =>
        connectedTools(by, inProject?.kind === "bot" ? inProject.plugins : undefined),
      ),
      project,
      userSkills,
      turn: { effort: input.effort ?? DEFAULT_EFFORT[input.mode], sessionId: input.id, by },
      title,
      save: (messages) => save(messages).then(() => learn(messages)),
      record: (event) => track(event, owner),
      fileOwner: by,
      automate:
        owner === undefined || input.timezone === undefined
          ? undefined
          : { owner, timezone: input.timezone },
      owner,
      sourceKinds: input.sources,
    });
  }),
);

app.get("/api/chat/:id/stream", async (c) => {
  const user = await userFor(c.req.raw.headers);
  const following = user ? followAnswer(user.id, c.req.param("id")) : undefined;
  if (!following) return c.body(null, 204);
  return new Response(
    following.pipeThrough(new TextEncoderStream()).pipeThrough(keepAlive(KEEPALIVE_MS)),
    { headers: { ...UI_MESSAGE_STREAM_HEADERS, "cache-control": "no-cache, no-transform" } },
  );
});

app.route("/api/files", uploadRoutes);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const SAME_SITE_PATH = /^\/(?![/\\])/u;

app.get("/api/connectors/callback", async (c) => {
  const user = await userFor(c.req.raw.headers);
  const back = user
    ? await finishConnect(user.id, c.req.query()).catch((err: Error) => {
        console.error(`connector not connected: ${reasonOf(err)}`);
        return undefined;
      })
    : undefined;
  return c.redirect(
    new URL(back && SAME_SITE_PATH.test(back) ? back : "/plugins", env.SITE_URL).href,
  );
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
