import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { z } from "zod";

const ISSUER = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REDIRECT_URI = `${ISSUER}/deviceauth/callback`;
export const CODEX_API = "https://chatgpt.com/backend-api/codex";
const CODEX_VERSION = "0.163.0";
const ORIGINATOR = "codex_cli_rs";
const AUTH_CLAIM = "https://api.openai.com/auth";
const TIMEOUT_MS = 15_000;

export const DEVICE_PAGE = `${ISSUER}/codex/device`;

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

const deviceCode = z.object({
  device_auth_id: z.string(),
  user_code: z.string(),
  interval: z.coerce.number().positive().catch(5),
  expires_at: z.string(),
});

const authorized = z.object({
  authorization_code: z.string(),
  code_verifier: z.string(),
});

const deviceError = z.object({ error: z.object({ code: z.string() }) });

const tokenResponse = z.object({
  id_token: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
});

const refreshed = tokenResponse.partial({
  id_token: true,
  refresh_token: true,
});

const identityClaims = z.object({
  sub: z.string(),
  email: z.string().optional(),
  email_verified: z.boolean().catch(false),
  [AUTH_CLAIM]: z.object({
    chatgpt_account_id: z.string(),
    chatgpt_plan_type: z.string().optional(),
  }),
});

export type DeviceLogin = {
  deviceAuthId: string;
  userCode: string;
  intervalMs: number;
  expiresAt: number;
};

export type DeviceTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const post = (path: string, body: string, type: string) =>
  fetch(`${ISSUER}${path}`, {
    method: "POST",
    headers: { "content-type": type, accept: "application/json" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

const postJson = (path: string, fields: Record<string, string>) =>
  post(path, JSON.stringify(fields), "application/json");

const postForm = (path: string, fields: Record<string, string>) =>
  post(path, new URLSearchParams(fields).toString(), "application/x-www-form-urlencoded");

const expiresAt = (accessToken: string) => (decodeJwt(accessToken).exp ?? 0) * 1000;

const tokensOf = (raw: z.output<typeof tokenResponse>): DeviceTokens => ({
  idToken: raw.id_token,
  accessToken: raw.access_token,
  refreshToken: raw.refresh_token,
  expiresAt: expiresAt(raw.access_token),
});

export async function startDeviceLogin(): Promise<DeviceLogin> {
  const response = await postJson("/api/accounts/deviceauth/usercode", {
    client_id: CLIENT_ID,
  });
  if (!response.ok) {
    throw new Error(`ChatGPT refused a sign-in code (${response.status})`);
  }
  const code = deviceCode.parse(await response.json());
  return {
    deviceAuthId: code.device_auth_id,
    userCode: code.user_code,
    intervalMs: code.interval * 1000,
    expiresAt: Date.parse(code.expires_at),
  };
}

export async function pollDeviceLogin(
  login: DeviceLogin,
): Promise<
  { status: "pending" } | { status: "expired" } | { status: "signed-in"; tokens: DeviceTokens }
> {
  if (Date.now() > login.expiresAt) return { status: "expired" };
  const response = await postJson("/api/accounts/deviceauth/token", {
    device_auth_id: login.deviceAuthId,
    user_code: login.userCode,
  });
  if (response.status === 404 || response.status === 429) return { status: "pending" };
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = deviceError.safeParse(body).data?.error.code;
    if (failure === "deviceauth_authorization_pending") return { status: "pending" };
    throw new Error(`ChatGPT sign-in failed (${response.status} ${failure ?? "no code"})`);
  }
  const code = authorized.parse(body);
  const exchanged = await postForm("/oauth/token", {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code: code.authorization_code,
    code_verifier: code.code_verifier,
    redirect_uri: REDIRECT_URI,
  });
  if (!exchanged.ok) {
    throw new Error(`ChatGPT token exchange failed (${exchanged.status})`);
  }
  return {
    status: "signed-in",
    tokens: tokensOf(tokenResponse.parse(await exchanged.json())),
  };
}

export async function refreshDeviceTokens(
  tokens: DeviceTokens,
): Promise<{ status: "ended" } | { status: "renewed"; tokens: DeviceTokens }> {
  const response = await postJson("/oauth/token", {
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    scope: "openid profile email",
  });
  if (response.status === 400 || response.status === 401) {
    return { status: "ended" };
  }
  if (!response.ok) {
    throw new Error(`ChatGPT could not renew the sign-in (${response.status})`);
  }
  const raw = refreshed.parse(await response.json());
  return {
    status: "renewed",
    tokens: {
      idToken: raw.id_token ?? tokens.idToken,
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token ?? tokens.refreshToken,
      expiresAt: expiresAt(raw.access_token),
    },
  };
}

export async function identityOf(tokens: DeviceTokens) {
  const { payload } = await jwtVerify(tokens.idToken, jwks, {
    issuer: ISSUER,
    audience: CLIENT_ID,
  });
  const claims = identityClaims.parse(payload);
  return {
    subject: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified,
    accountId: claims[AUTH_CLAIM].chatgpt_account_id,
    plan: claims[AUTH_CLAIM].chatgpt_plan_type,
  };
}

const cacheKeyed = z.object({ prompt_cache_key: z.string().optional() });

const cacheKeyOf = (body: RequestInit["body"]) => {
  const text = z.string().safeParse(body);
  return text.success
    ? cacheKeyed.safeParse(JSON.parse(text.data)).data?.prompt_cache_key
    : undefined;
};

export const codexFetch = (
  credentials: () => Promise<{ accessToken: string; accountId: string }>,
) =>
  Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const { accessToken, accountId } = await credentials();
      const url = new URL(input instanceof Request ? input.url : input.toString(), `${CODEX_API}/`);
      url.searchParams.set("client_version", CODEX_VERSION);
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${accessToken}`);
      headers.set("chatgpt-account-id", accountId);
      headers.set("openai-beta", "responses=experimental");
      headers.set("originator", ORIGINATOR);
      const cacheKey = cacheKeyOf(init?.body);
      if (cacheKey) headers.set("session-id", cacheKey);
      return fetch(url, { ...init, headers });
    },
    { preconnect: fetch.preconnect },
  );
