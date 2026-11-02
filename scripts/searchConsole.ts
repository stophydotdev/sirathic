import { z } from "zod";

const PROPERTY = "sc-domain:sirathic.com";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DAY_MS = 86_400_000;

const account = z.object({ client_email: z.string(), private_key: z.string() });
const token = z.object({ access_token: z.string() });
const report = z.object({
  rows: z.array(z.object({ keys: z.array(z.string()), impressions: z.number() })).default([]),
});

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

const day = (ago: number) => new Date(Date.now() - ago * DAY_MS).toISOString().slice(0, 10);

const accessToken = async (credentials: z.infer<typeof account>) => {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const claims = JSON.stringify({
    iss: credentials.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });
  const unsigned = [header, claims]
    .map((part) => base64url(new TextEncoder().encode(part)))
    .join(".");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(credentials.private_key.replaceAll(/-----[A-Z ]+-----|\s/gu, ""), "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
  });
  if (!response.ok) throw new Error(`Search Console token: HTTP ${response.status}`);
  return token.parse(await response.json()).access_token;
};

export const searchedQueries = async (
  serviceAccount: string | undefined,
  minImpressions: number,
) => {
  if (!serviceAccount) return [];
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await accessToken(account.parse(JSON.parse(serviceAccount)))}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startDate: day(31),
        endDate: day(3),
        dimensions: ["query"],
        rowLimit: 100,
      }),
    },
  );
  if (!response.ok) throw new Error(`Search Console query: HTTP ${response.status}`);
  return report
    .parse(await response.json())
    .rows.filter((row) => row.impressions >= minImpressions)
    .map((row) => row.keys[0] ?? "")
    .filter(Boolean);
};
