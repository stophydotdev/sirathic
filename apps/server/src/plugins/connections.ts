import {
  auth,
  type CallToolResult,
  createMCPClient,
  type MCPClient,
  type OAuthClientMetadata,
  type OAuthClientProvider,
} from "@ai-sdk/mcp";
import { cacheFor, dropCached, dropKept, readKept } from "@sirathic/core/cache";
import { db } from "@sirathic/db";
import { connections } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import { type Tool, tool } from "ai";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { reasonOf, StatusError } from "../http";
import { ownerCache } from "../account/ownerCache";
import { seal, unseal } from "../account/vault";
import { publicUrl } from "./address";
import { emailEditKey, outgoingEmail } from "./outgoingEmail";
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
const TOOLS_FRESH_MS = 6 * 60 * 60_000;
const MISSING_SCOPE = /insufficient authentication scopes/iu;

type Listed = Tool<unknown, CallToolResult>;

const TOOLS_NAMESPACE = "mcpTools";

const savedTools = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      inputSchema: z.looseObject({
        type: z.unknown().optional(),
        properties: z.looseObject({}).optional(),
      }),
      annotations: z
        .looseObject({
          title: z.string().optional(),
          readOnlyHint: z.boolean().optional(),
          destructiveHint: z.boolean().optional(),
          idempotentHint: z.boolean().optional(),
          openWorldHint: z.boolean().optional(),
        })
        .optional(),
      _meta: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

const savedToolLists = cacheFor({
  namespace: TOOLS_NAMESPACE,
  schema: savedTools,
  freshMs: TOOLS_FRESH_MS,
  keepMs: TOOLS_FRESH_MS,
});

const toolsFromSaved = createMCPClient({
  transport: { start: async () => {}, send: async () => {}, close: async () => {} },
  initialInitializeResult: {
    protocolVersion: "2025-06-18",
    capabilities: { tools: {} },
    serverInfo: { name: "saved-tools", version: "1" },
  },
});

const GOOGLE_CLIENT = {
  issuer: "https://accounts.google.com",
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
  returnTo: z.string().optional(),
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

const connectedRows = ownerCache<Awaited<ReturnType<typeof loadConnectedRows>>>();
const connectionLists = ownerCache<Awaited<ReturnType<typeof loadConnections>>>();

const forgetOwner = (owner: string) => {
  connectedRows.clear(owner);
  connectionLists.clear(owner);
};

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

async function storedFor(owner: string, connector: string): Promise<Secrets> {
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
  forgetOwner(owner);
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
    clientInformation: () =>
      server.googleScopes ? { ...secrets.client, ...GOOGLE_CLIENT } : secrets.client,
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

export const listConnections = (owner: string) =>
  connectionLists.get(owner, () => loadConnections(owner));

async function loadConnections(owner: string) {
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

export async function connect(owner: string, id: string, returnTo = "/plugins") {
  const server = await serverOf(owner, id);
  if (server.open || (!isCatalog(id) && (await opensWithoutSignIn(server.url)))) {
    await store(owner, id, {}, true);
    return { status: "connected" as const };
  }
  const stored = await storedFor(owner, id);
  const { provider, authorizationUrl } = providerFor(owner, id, server, { ...stored, returnTo });
  const granted = stored.tokens?.scope?.split(" ") ?? [];
  const needsMore = server.googleScopes?.some((scope) => !granted.includes(scope));
  const result = await auth(needsMore ? { ...provider, tokens: () => undefined } : provider, {
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
  forgetOwner(owner);
  return connect(owner, id).catch(async (err: Error) => {
    await disconnect(owner, id);
    throw err;
  });
}

export async function finishConnect(owner: string, query: Record<string, string>) {
  const { state, code, iss } = callbackQuery.parse(query);
  const connector = pluginId.parse(state.split(".")[0]);
  const stored = await storedFor(owner, connector);
  if (!code) return stored.returnTo;
  const server = await serverOf(owner, connector);
  const { provider } = providerFor(owner, connector, server, stored);
  await auth(provider, {
    serverUrl: server.url,
    authorizationCode: code,
    callbackState: state,
    callbackIssuer: iss,
  }).catch((err: Error) => console.error(`connector not connected: ${reasonOf(err)}`));
  return stored.returnTo;
}

export async function disconnect(owner: string, connector: string) {
  await dropCached(TOOLS_NAMESPACE, `${owner}:${connector}`);
  await db.delete(connections).where(owned(owner, connector));
  forgetOwner(owner);
}

const toolArguments = z.record(z.string(), z.unknown());

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const sentEmail = z.object({ id: z.string(), threadId: z.string() });

const base64 = (text: string) => Buffer.from(text).toString("base64");

export const mimeOf = ({ to, cc, bcc, subject, body }: z.infer<typeof outgoingEmail>) =>
  [
    `To: ${to.join(", ")}`,
    ...(cc?.length ? [`Cc: ${cc.join(", ")}`] : []),
    ...(bcc?.length ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: =?UTF-8?B?${base64(subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(body),
  ].join("\r\n");

export const emailToSend = async (
  owner: string,
  toolCallId: string,
  asked: z.infer<typeof outgoingEmail>,
) => {
  const kept = await readKept(emailEditKey(owner, toolCallId));
  return kept === null ? asked : outgoingEmail.parse(JSON.parse(kept));
};

const gmailSendTool = (owner: string, connector: string) =>
  tool({
    description:
      "Send an email from the user's Gmail. They see this exact email on a card and it goes out only when they confirm, so put the whole message in the call. To keep a draft in their mailbox instead, use gmail_create_draft.",
    inputSchema: outgoingEmail,
    execute: async (asked, { toolCallId }) => {
      const email = await emailToSend(owner, toolCallId, asked);
      const server = CONNECTORS.gmail;
      const { provider } = providerFor(owner, connector, server, await storedFor(owner, connector));
      const signedIn = await auth(provider, { serverUrl: server.url });
      const token = signedIn === "AUTHORIZED" ? (await provider.tokens())?.access_token : undefined;
      if (!token) {
        throw new Error(
          "Not signed in: Gmail needs the user to sign in again. Call install_plugin with id gmail so they can do it on the card, then end your turn.",
        );
      }
      const response = await fetch(GMAIL_SEND_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ raw: Buffer.from(mimeOf(email)).toString("base64url") }),
      });
      if (!response.ok) throw new Error(`Gmail did not send it: ${await response.text()}`);
      await dropKept(emailEditKey(owner, toolCallId));
      return {
        sent: true,
        ...sentEmail.parse(await response.json()),
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        edited: mimeOf(email) !== mimeOf(asked),
      };
    },
  });

type ConnectionRow = {
  connector: string;
  name: string | null;
  url: string | null;
  secrets: string;
};

async function openClient(owner: string, row: ConnectionRow, signal: AbortSignal) {
  const server = await serverFrom(row);
  const stored = await unsealed(row.secrets);
  const authProvider = stored.tokens
    ? providerFor(owner, row.connector, server, stored).provider
    : undefined;
  return createMCPClient({
    transport: { type: "http", url: server.url, authProvider },
    initializationOptions: { signal },
  });
}

async function connectorTools(owner: string, row: ConnectionRow) {
  const key = `${owner}:${row.connector}`;
  let client: Promise<MCPClient> | undefined;
  const open = (signal: AbortSignal) => (client ??= openClient(owner, row, signal));
  const list = async () => {
    const signal = AbortSignal.timeout(ANSWER_CONNECT_MS);
    const connected = await open(signal);
    try {
      return await connected.listTools({ options: { signal } });
    } catch (err) {
      await connected.close();
      throw err;
    }
  };
  const lazy = (name: string, listed: Listed): Listed => ({
    ...listed,
    execute: async (args, options) => {
      const connected = await open(AbortSignal.timeout(CONNECT_TIMEOUT_MS));
      return connected
        .callTool({
          name,
          arguments: toolArguments.parse(args),
          options: { signal: options.abortSignal },
        })
        .catch(async (err: Error) => {
          if (!options.abortSignal?.aborted) await dropCached(TOOLS_NAMESPACE, key);
          if (MISSING_SCOPE.test(err.message)) {
            throw new Error(
              `Needs more access: the user has not allowed this in ${row.connector} yet. Call install_plugin with id ${row.connector} so they can allow it on the card, then end your turn.`,
            );
          }
          throw err;
        });
    },
  });
  const listed = (await toolsFromSaved).toolsFromDefinitions(await savedToolLists(key, list));
  return {
    tools: [
      ...Object.entries(listed).map(
        ([name, entry]) => [toolName(row.connector, name), lazy(name, entry)] as const,
      ),
      ...(row.connector === "gmail"
        ? [[toolName(row.connector, "send_email"), gmailSendTool(owner, row.connector)] as const]
        : []),
    ],
    close: async () => void (await client?.then((connected) => connected.close())),
  };
}

const loadConnectedRows = async (owner: string) =>
  db
    .select({
      connector: connections.connector,
      name: connections.name,
      url: connections.url,
      secrets: connections.secrets,
    })
    .from(connections)
    .where(and(eq(connections.owner, owner), eq(connections.connected, true)));

export async function connectedTools(owner: string, only?: readonly string[] | null) {
  const rows = await connectedRows
    .get(owner, () => loadConnectedRows(owner))
    .catch((err: Error) => {
      console.error(`connectors not loaded: ${reasonOf(err)}`);
      return [];
    });
  const allowed = only ? rows.filter((row) => only.includes(row.connector)) : rows;
  const opened = await Promise.all(
    allowed.map((row) =>
      connectorTools(owner, row).catch((err: Error) => {
        console.warn(`${row.connector} tools skipped: ${reasonOf(err)}`);
        return undefined;
      }),
    ),
  );
  const ready = opened.filter((connector) => connector !== undefined);
  return {
    tools: Object.fromEntries(ready.flatMap(({ tools }) => tools)),
    close: () => Promise.allSettled(ready.map(({ close }) => close())),
  };
}
