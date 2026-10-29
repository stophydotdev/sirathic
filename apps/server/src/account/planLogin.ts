import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const TIMEOUT_MS = 15_000;

const MINIMAX_PORTAL = "https://api.minimax.io";
const MINIMAX_CLIENT = "78257093-7e40-4613-99e0-527b14b39113";
const MINIMAX_USER_CODE = "urn:ietf:params:oauth:grant-type:user_code";

const XAI_AUTH = "https://auth.x.ai/oauth2";
const XAI_CLIENT = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code";
const XAI_TOKEN_SECONDS = 3600;

export const planLogin = z.object({
  userCode: z.string(),
  verificationUrl: z.url(),
  intervalMs: z.number(),
  expiresAt: z.number(),
  secret: z.string(),
});

export type PlanLogin = z.infer<typeof planLogin>;

export type PlanTokens = { accessToken: string; refreshToken: string; expiresAt: number };

type Approval =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "approved"; tokens: PlanTokens };

type Renewal = { status: "ended" } | { status: "renewed"; tokens: PlanTokens };

const minimaxCode = z.object({
  user_code: z.string(),
  verification_uri: z.url(),
  expired_in: z.number(),
  interval: z.number().catch(3000),
});

const minimaxGranted = z.object({
  status: z.literal("success"),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expired_in: z.number(),
});

const minimaxStatus = z.object({ status: z.string() });

const xaiCode = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri_complete: z.url(),
  expires_in: z.number(),
  interval: z.number().catch(5),
});

const xaiGranted = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().catch(XAI_TOKEN_SECONDS),
});

const xaiError = z.object({ error: z.string() });

const postForm = (url: string, fields: Record<string, string>, headers?: Record<string, string>) =>
  fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

const minimaxExpiry = (expiredIn: number) =>
  expiredIn > 1e12 ? expiredIn : Date.now() + expiredIn * 1000;

const minimaxTokens = (
  granted: z.infer<typeof minimaxGranted>,
  refreshToken: string,
): PlanTokens => ({
  accessToken: granted.access_token,
  refreshToken: granted.refresh_token ?? refreshToken,
  expiresAt: minimaxExpiry(granted.expired_in),
});

const xaiTokens = (granted: z.infer<typeof xaiGranted>, refreshToken: string): PlanTokens => ({
  accessToken: granted.access_token,
  refreshToken: granted.refresh_token ?? refreshToken,
  expiresAt: Date.now() + granted.expires_in * 1000,
});

const minimax = {
  async start(): Promise<PlanLogin> {
    const verifier = randomBytes(32).toString("base64url");
    const response = await postForm(
      `${MINIMAX_PORTAL}/oauth/code`,
      {
        response_type: "code",
        client_id: MINIMAX_CLIENT,
        scope: "group_id profile model.completion",
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
        state: randomBytes(16).toString("base64url"),
      },
      { "x-request-id": crypto.randomUUID() },
    );
    if (!response.ok) throw new Error(`MiniMax refused a sign-in code (${response.status})`);
    const code = minimaxCode.parse(await response.json());
    return {
      userCode: code.user_code,
      verificationUrl: code.verification_uri,
      intervalMs: code.interval,
      expiresAt: minimaxExpiry(code.expired_in),
      secret: verifier,
    };
  },
  async poll(login: PlanLogin): Promise<Approval> {
    const response = await postForm(`${MINIMAX_PORTAL}/oauth/token`, {
      grant_type: MINIMAX_USER_CODE,
      client_id: MINIMAX_CLIENT,
      user_code: login.userCode,
      code_verifier: login.secret,
    });
    if (!response.ok) throw new Error(`MiniMax sign-in failed (${response.status})`);
    const body = await response.json();
    const granted = minimaxGranted.required({ refresh_token: true }).safeParse(body);
    if (granted.success) {
      return {
        status: "approved",
        tokens: minimaxTokens(granted.data, granted.data.refresh_token),
      };
    }
    if (minimaxStatus.parse(body).status === "error") {
      throw new Error("MiniMax turned the sign-in down");
    }
    return { status: "pending" };
  },
  async refresh(tokens: PlanTokens): Promise<Renewal> {
    const response = await postForm(`${MINIMAX_PORTAL}/oauth/token`, {
      grant_type: "refresh_token",
      client_id: MINIMAX_CLIENT,
      refresh_token: tokens.refreshToken,
    });
    if (response.status === 400 || response.status === 401) return { status: "ended" };
    if (!response.ok) throw new Error(`MiniMax could not renew the sign-in (${response.status})`);
    const granted = minimaxGranted.safeParse(await response.json());
    return granted.success
      ? { status: "renewed", tokens: minimaxTokens(granted.data, tokens.refreshToken) }
      : { status: "ended" };
  },
};

const xai = {
  async start(): Promise<PlanLogin> {
    const response = await postForm(`${XAI_AUTH}/device/code`, {
      client_id: XAI_CLIENT,
      scope: XAI_SCOPE,
    });
    if (!response.ok) throw new Error(`xAI refused a sign-in code (${response.status})`);
    const code = xaiCode.parse(await response.json());
    return {
      userCode: code.user_code,
      verificationUrl: code.verification_uri_complete,
      intervalMs: code.interval * 1000,
      expiresAt: Date.now() + code.expires_in * 1000,
      secret: code.device_code,
    };
  },
  async poll(login: PlanLogin): Promise<Approval> {
    const response = await postForm(`${XAI_AUTH}/token`, {
      grant_type: DEVICE_CODE,
      client_id: XAI_CLIENT,
      device_code: login.secret,
    });
    const body = await response.json().catch(() => undefined);
    if (response.ok) {
      const granted = xaiGranted.required({ refresh_token: true }).parse(body);
      return { status: "approved", tokens: xaiTokens(granted, granted.refresh_token) };
    }
    const error = xaiError.safeParse(body).data?.error;
    if (error === "authorization_pending" || error === "slow_down") return { status: "pending" };
    if (error === "expired_token") return { status: "expired" };
    throw new Error(`xAI sign-in failed (${response.status} ${error ?? "no code"})`);
  },
  async refresh(tokens: PlanTokens): Promise<Renewal> {
    const response = await postForm(`${XAI_AUTH}/token`, {
      grant_type: "refresh_token",
      client_id: XAI_CLIENT,
      refresh_token: tokens.refreshToken,
    });
    if (response.status === 400 || response.status === 401) return { status: "ended" };
    if (!response.ok) throw new Error(`xAI could not renew the sign-in (${response.status})`);
    return {
      status: "renewed",
      tokens: xaiTokens(xaiGranted.parse(await response.json()), tokens.refreshToken),
    };
  },
};

export const PLAN_LOGINS = { minimax, xai };
