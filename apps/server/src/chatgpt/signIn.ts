import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { clientOf } from "../client";
import { track } from "../events";
import { signIn } from "../users";
import { seal, unseal } from "../vault";
import { DEVICE_PAGE, pollDeviceLogin, startDeviceLogin } from "./device";

const DEVICE_COOKIE = "chatgpt_device";

const deviceLogin = z.object({
  deviceAuthId: z.string(),
  userCode: z.string(),
  intervalMs: z.number(),
  expiresAt: z.number(),
});

export const chatgptSignIn = () =>
  ({
    id: "chatgpt",
    endpoints: {
      startChatGPTSignIn: createAuthEndpoint(
        "/chatgpt/start",
        { method: "POST" },
        async (ctx) => {
          const login = await startDeviceLogin();
          track({
            name: "signin",
            props: {
              step: "started",
              via: "chatgpt",
              ...clientOf(ctx.headers ?? new Headers()),
            },
          });
          const cookie = ctx.context.createAuthCookie(DEVICE_COOKIE);
          ctx.setCookie(cookie.name, await seal(JSON.stringify(login)), {
            ...cookie.attributes,
            expires: new Date(login.expiresAt),
          });
          return ctx.json({
            userCode: login.userCode,
            intervalMs: login.intervalMs,
            expiresAt: login.expiresAt,
            verificationUrl: DEVICE_PAGE,
          });
        },
      ),
      pollChatGPTSignIn: createAuthEndpoint(
        "/chatgpt/poll",
        { method: "GET" },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie(DEVICE_COOKIE);
          const sealed = ctx.getCookie(cookie.name);
          const login = sealed
            ? deviceLogin.safeParse(
                JSON.parse(await unseal(sealed).catch(() => "null")),
              ).data
            : undefined;
          if (!login) return ctx.json({ status: "expired" as const });
          const polled = await pollDeviceLogin(login);
          if (polled.status === "pending") {
            return ctx.json({ status: "pending" as const });
          }
          ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });
          if (polled.status === "expired") {
            track({ name: "signin", props: { step: "expired" } });
            return ctx.json({ status: "expired" as const });
          }
          const userId = await signIn(polled.tokens);
          const user = await ctx.context.internalAdapter.findUserById(userId);
          const session =
            await ctx.context.internalAdapter.createSession(userId);
          if (!user) throw new APIError("NOT_FOUND");
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ status: "signed-in" as const });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
