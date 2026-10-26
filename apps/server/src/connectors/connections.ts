import {
  auth,
  createMCPClient,
  type OAuthClientMetadata,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import { db } from "@sirathic/db";
import { connections } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { reasonOf, StatusError } from "../respond";
import { seal, unseal } from "../vault";
import { publicUrl } from "./address";
import {
  CONNECTOR_IDS,
  CONNECTORS,
  type ConnectorId,
  connectorId,
  newCustomId,
  pluginId,
  popularOf,
  toolName,
} from "./catalog";

const REDIRECT_URL = new URL("/api/connectors/callback", env.SITE_URL).href;
const CONNECT_TIMEOUT_MS = 10_000;
const ANSWER_CONNECT_MS = 3_000;

const GOOGLE_CLIENT = {
  client_id: env.GOOGLE_CLIENT_ID,
  client_secret: env.GOOGLE_CLIENT_SECRET,
};

const CLIENT_METADATA = {
  client_name: "Sirathic",
  redirect_uris: [REDIRECT_URL],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
} satisfies OAuthClientMetadata;

const issuedBy = {
  issuer: z.string().optional(),
  authorization_server: z.string().optional(),
  token_endpoint: z.string().optional(),
};

const storedSecrets = z.object({
  client: z
    .object({
      client_id: z.string(),
      client_secret: z.string().optional(),
      client_id_issued_at: z.number().optional(),
      client_secret_expires_at: z.number().optional(),
      ...issuedBy,
    })
    .optional(),
  tokens: z
    .object({
      access_token: z.string(),
      id_token: z.string().optional(),
      token_type: z.string(),
      expires_in: z.number().optional(),
      scope: z.string().optional(),
      refresh_token: z.string().optional(),
      ...issuedBy,
    })
    .optional(),
  verifier: z.string().optional(),
  state: z.string().optional(),
});

type Secrets = z.infer<typeof storedSecrets>;

export const FORGET = {
  all: { client: undefined, tokens: undefined, verifier: undefined, state: undefined },
  client: { client: undefined },
  tokens: { tokens: undefined },
  verifier: { verifier: undefined },
} satisfies Record<string, Partial<Secrets>>;

export const withUpdate = (secrets: Secrets, update: Partial<Secrets>) => {
  const merged = { ...secrets, ...update };
  return { secrets: merged, connected: merged.tokens !== undefined };
};

const callbackQuery = z.object({
  state: z.string(),
  code: z.string().optional(),
  iss: z.string().optional(),
});

type Server = {
  name: string;
  url: string;
  open?: true;
  tokenAuth?: "none" | "client_secret_post";
  googleScopes?: readonly string[];
};

export const customInput = z.object({
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().max(500),
});

const owned = (owner: string, connector: string) =>
  and(eq(connections.owner, owner), eq(connections.connector, connector));

const isCatalog = (id: string): id is ConnectorId => connectorId.safeParse(id).success;

async function serverFrom(row: {
  connector: string;
  name: string | null;
  url: string | null;
}): Promise<Server> {
  if (isCatalog(row.connector)) return CONNECTORS[row.connector];
  if (!row.name || !row.url) throw new StatusError(404, "no such plugin");
  await publicUrl(row.url);
  return { name: row.name, url: row.url };
}

async function serverOf(owner: string, id: string): Promise<Server> {
  if (isCatalog(id)) return CONNECTORS[id];
  const [row] = await db
    .select({ connector: connections.connector, name: connections.name, url: connections.url })
    .from(connections)
    .where(owned(owner, id));
  if (!row) throw new StatusError(404, "no such plugin");
  return serverFrom(row);
}

const unsealed = async (sealed: string) => storedSecrets.parse(JSON.parse(await unseal(sealed)));

async function storedFor(owner: string, connector: string) {
  const [row] = await db
    .select({ secrets: connections.secrets })
    .from(connections)
    .where(owned(owner, connector));
  return row ? unsealed(row.secrets) : {};
}

async function store(owner: string, connector: string, secrets: Secrets, connected: boolean) {
  const row = { secrets: await seal(JSON.stringify(secrets)), connected };
  await db
    .insert(connections)
    .values({ owner, connector, ...row })
    .onConflictDoUpdate({ target: [connections.owner, connections.connector], set: row });
}

function providerFor(owner: string, connector: string, server: Server, stored: Secrets) {
  let secrets = stored;
  let authorizationUrl: URL | undefined;
  const save = async (update: Partial<Secrets>) => {
    const next = withUpdate(secrets, update);
    secrets = next.secrets;
    await store(owner, connector, secrets, next.connected);
  };
  const provider: OAuthClientProvider = {
    redirectUrl: REDIRECT_URL,
    clientMetadata: server.tokenAuth
      ? { ...CLIENT_METADATA, token_endpoint_auth_method: server.tokenAuth }
      : CLIENT_METADATA,
    clientInformation: () => (server.googleScopes ? GOOGLE_CLIENT : secrets.client),
    saveClientInformation: (client) => save({ client }),
    isClientInformationDynamicallyRegistered: () => !server.googleScopes,
    tokens: () => secrets.tokens,
    saveTokens: (tokens) => save({ tokens, verifier: undefined, state: undefined }),
    codeVerifier: () => {
      if (!secrets.verifier) throw new StatusError(400, "start connecting again");
      return secrets.verifier;
    },
    saveCodeVerifier: (verifier) => save({ verifier }),
    state: () => `${connector}.${crypto.randomUUID()}`,
    saveState: (state) => save({ state }),
    storedState: () => secrets.state,
    redirectToAuthorization: (url) => {
      if (server.googleScopes) {
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
      }
      authorizationUrl = url;
    },
    invalidateCredentials: (scope) => save(FORGET[scope]),
  };
  return { provider, authorizationUrl: () => authorizationUrl };
}

export async function listConnections(owner: string) {
  const [rows, counts] = await Promise.all([
    db
      .select({
        connector: connections.connector,
        name: connections.name,
        url: connections.url,
        connected: connections.connected,
      })
      .from(connections)
      .where(eq(connections.owner, owner)),
    db
      .select({ connector: connections.connector, users: count() })
      .from(connections)
      .where(eq(connections.connected, true))
      .groupBy(connections.connector),
  ]);
  const popular = popularOf(counts.filter((row) => isCatalog(row.connector)));
  const connected = new Set(rows.filter((row) => row.connected).map((row) => row.connector));
  const custom = rows.flatMap((row) =>
    !isCatalog(row.connector) && row.name && row.url
      ? [
          {
            id: row.connector,
            name: row.name,
            category: "custom" as const,
            url: row.url,
            connected: row.connected,
            popular: false,
          },
        ]
      : [],
  );
  const catalog = CONNECTOR_IDS.map((id) => ({
    id,
    name: CONNECTORS[id].name,
    category: CONNECTORS[id].category,
    url: CONNECTORS[id].url,
    connected: connected.has(id),
    popular: popular.has(id),
  }));
  return [...custom, ...catalog];
}

const opensWithoutSignIn = (url: string) =>
  createMCPClient({
    transport: { type: "http", url },
    initializationOptions: { timeout: CONNECT_TIMEOUT_MS },
  }).then(
    (client) =>
      client
        .listTools({ options: { timeout: CONNECT_TIMEOUT_MS } })
        .then(
          () => true,
          () => false,
        )
        .finally(() => client.close()),
    () => false,
  );

export async function connect(owner: string, id: string) {
  const server = await serverOf(owner, id);
  if (server.open || (!isCatalog(id) && (await opensWithoutSignIn(server.url)))) {
    await store(owner, id, {}, true);
    return { status: "connected" as const };
  }
  const { provider, authorizationUrl } = providerFor(owner, id, server, await storedFor(owner, id));
  const result = await auth(provider, {
    serverUrl: server.url,
    scope: server.googleScopes?.join(" "),
  }).catch((err: Error) => {
    throw new StatusError(502, `${server.name} sign-in failed: ${err.message}`);
  });
  const url = authorizationUrl();
  if (result === "AUTHORIZED") return { status: "connected" as const };
  if (!url) throw new StatusError(502, `${server.name} gave no sign-in page`);
  return { status: "redirect" as const, url: url.href };
}

export async function addCustom(owner: string, input: z.output<typeof customInput>) {
  const url = await publicUrl(input.url);
  const id = newCustomId();
  await db.insert(connections).values({
    owner,
    connector: id,
    name: input.name,
    url: url.href,
    secrets: await seal(JSON.stringify({})),
  });
  return connect(owner, id).catch(async (err: Error) => {
    await disconnect(owner, id);
    throw err;
  });
}

export async function finishConnect(owner: string, query: Record<string, string>) {
  const { state, code, iss } = callbackQuery.parse(query);
  const connector = pluginId.parse(state.split(".")[0]);
  if (!code) return;
  const server = await serverOf(owner, connector);
  const { provider } = providerFor(owner, connector, server, await storedFor(owner, connector));
  await auth(provider, {
    serverUrl: server.url,
    authorizationCode: code,
    callbackState: state,
    callbackIssuer: iss,
  });
}

export async function disconnect(owner: string, connector: string) {
  await db.delete(connections).where(owned(owner, connector));
}

async function openConnector(
  owner: string,
  row: { connector: string; name: string | null; url: string | null; secrets: string },
) {
  const server = await serverFrom(row);
  const stored = await unsealed(row.secrets);
  const authProvider = stored.tokens
    ? providerFor(owner, row.connector, server, stored).provider
    : undefined;
  const signal = AbortSignal.timeout(ANSWER_CONNECT_MS);
  const client = await createMCPClient({
    transport: { type: "http", url: server.url, authProvider },
    initializationOptions: { signal },
  });
  try {
    const definitions = await client.listTools({ options: { signal } });
    const tools = Object.entries(client.toolsFromDefinitions(definitions)).map(
      ([name, tool]) => [toolName(row.connector, name), tool] as const,
    );
    return { client, tools };
  } catch (err) {
    await client.close();
    throw err;
  }
}

export async function connectedTools(owner: string, only?: readonly string[] | null) {
  const rows = await db
    .select({
      connector: connections.connector,
      name: connections.name,
      url: connections.url,
      secrets: connections.secrets,
    })
    .from(connections)
    .where(and(eq(connections.owner, owner), eq(connections.connected, true)))
    .catch((err: Error) => {
      console.error(`connectors not loaded: ${reasonOf(err)}`);
      return [];
    });
  const allowed = only ? rows.filter((row) => only.includes(row.connector)) : rows;
  const opened = await Promise.all(
    allowed.map((row) =>
      openConnector(owner, row).catch((err: Error) => {
        console.warn(`${row.connector} tools skipped: ${reasonOf(err)}`);
        return undefined;
      }),
    ),
  );
  const ready = opened.filter((connector) => connector !== undefined);
  return {
    tools: Object.fromEntries(ready.flatMap(({ tools }) => tools)),
    close: () => Promise.allSettled(ready.map(({ client }) => client.close())),
  };
}
