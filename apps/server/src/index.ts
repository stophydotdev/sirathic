import { trpcServer } from "@hono/trpc-server";
import { env } from "@sirathic/env/server";
import { validateUIMessages } from "ai";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { chatResponse } from "./chat/response";
import { chatTitle } from "./chat/title";
import { type ChatMessage, mode } from "./shared/messages";
import { parseBody, reasonOf, respond, StatusError } from "./respond";
import {
  answerOptions,
  chatModel,
  DEFAULT_MODEL,
  sideOptions,
} from "./chatgpt/codex";
import {
  DEVICE_PAGE,
  pollDeviceLogin,
  startDeviceLogin,
} from "./chatgpt/device";
import { appRouter, createContext } from "./router";
import { getSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./shared/settings";
import {
  messageSchemas,
  saveSession,
  sessionId,
  titleSession,
} from "./sessions";
import { SESSION_DAYS, signIn, signOut, userFor } from "./users";
import { seal, unseal } from "./vault";

const IDLE_TIMEOUT_SECONDS = 255;

const chatBody = z.object({
  id: sessionId,
  messages: z.array(z.unknown()).min(1),
  model: z.string().min(1).optional(),
  mode: mode.default("quick"),
  incognito: z.boolean().default(false),
});

const SESSION_COOKIE = "sirathic_session";
const DEVICE_COOKIE = "sirathic_device";

const deviceLogin = z.object({
  deviceAuthId: z.string(),
  userCode: z.string(),
  intervalMs: z.number(),
  expiresAt: z.number(),
});

const secure = (c: Context) =>
  (c.req.header("x-forwarded-proto") ??
    new URL(c.req.url).protocol.slice(0, -1)) === "https";

const pendingLogin = async (c: Context) => {
  const sealed = getCookie(c, DEVICE_COOKIE);
  if (!sealed) return undefined;
  return deviceLogin.safeParse(
    JSON.parse(await unseal(sealed).catch(() => "null")),
  ).data;
};

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
    const user = await userFor(getCookie(c, SESSION_COOKIE));
    if (!user) throw new StatusError(401, "not signed in");
    const by = user.id;
    const validated = await validateUIMessages<ChatMessage>({
      messages: input.messages,
      ...messageSchemas,
    }).catch((err: Error) => {
      throw new StatusError(400, err.message);
    });
    let saving = Promise.resolve();
    const save = (messages: typeof validated) => {
      if (input.incognito) return saving;
      saving = saving
        .catch(() => undefined)
        .then(() => saveSession(input.id, by, messages));
      return saving;
    };
    const saved = save(validated);
    saved.catch((err: Error) => {
      console.error(`session not saved: ${reasonOf(err)}`);
    });
    const chosen = chatModel(user, input.model);
    const small = chatModel(user);
    const title = input.incognito
      ? undefined
      : saved
          .then(() =>
            titleSession(input.id, by, validated, () =>
              chatTitle(small, validated, sideOptions),
            ),
          )
          .catch((err: Error) => {
            console.error(`title not set: ${reasonOf(err)}`);
            return undefined;
          });
    return chatResponse({
      models: { model: chosen, small },
      modelName: input.model ?? DEFAULT_MODEL,
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
    });
  }),
);

app.post("/api/auth/device", (c) =>
  respond(async () => {
    const login = await startDeviceLogin();
    setCookie(c, DEVICE_COOKIE, await seal(JSON.stringify(login)), {
      httpOnly: true,
      secure: secure(c),
      sameSite: "Lax",
      path: "/api/auth",
      expires: new Date(login.expiresAt),
    });
    return c.json({
      userCode: login.userCode,
      intervalMs: login.intervalMs,
      expiresAt: login.expiresAt,
      verificationUrl: DEVICE_PAGE,
    });
  }),
);

app.get("/api/auth/device", (c) =>
  respond(async () => {
    const login = await pendingLogin(c);
    if (!login) return c.json({ status: "expired" as const });
    const polled = await pollDeviceLogin(login);
    if (polled.status === "pending") {
      return c.json({ status: "pending" as const });
    }
    deleteCookie(c, DEVICE_COOKIE, { path: "/api/auth" });
    if (polled.status === "expired") {
      return c.json({ status: "expired" as const });
    }
    setCookie(c, SESSION_COOKIE, await signIn(polled.tokens), {
      httpOnly: true,
      secure: secure(c),
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    return c.json({ status: "signed-in" as const });
  }),
);

app.post("/api/auth/logout", (c) =>
  respond(async () => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await signOut(token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ signedOut: true });
  }),
);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_options, c) => createContext(getCookie(c, SESSION_COOKIE)),
  }),
);

export default {
  port: env.PORT,
  idleTimeout: IDLE_TIMEOUT_SECONDS,
  fetch: app.fetch,
};
