import { db } from "@sirathic/db";
import { vaultLogins } from "@sirathic/db/schema";
import { isOnSite, siteHost } from "@sirathic/core/web/url";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { listContacts } from "./contacts";
import { checkToken, onePasswordLogin } from "./onePassword";
import { seal, unseal } from "./seal";
import { setupKey, totp } from "./totp";

const ONE_PASSWORD_SITE = "";

export const vaultLogin = z.object({
  site: siteHost,
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(500),
  code: setupKey.optional(),
});

const sealedLogin = vaultLogin.omit({ site: true });

export const onePasswordToken = z.string().trim().startsWith("ops_").max(4_000);

const sealedToken = z.object({ token: onePasswordToken });

const opened = async <Schema extends z.ZodType>(
  schema: Schema,
  { owner, site, sealed }: { owner: string; site: string; sealed: string },
) => schema.parse(JSON.parse(await unseal(sealed, owner, site)));

const keep = async (
  owner: string,
  kind: "login" | "onepassword",
  site: string,
  plain: z.infer<typeof sealedLogin> | z.infer<typeof sealedToken>,
) => {
  const sealed = await seal(JSON.stringify(plain), owner, site);
  return db
    .insert(vaultLogins)
    .values({ owner, kind, site, sealed })
    .onConflictDoUpdate({ target: [vaultLogins.owner, vaultLogins.site], set: { sealed } })
    .returning({ id: vaultLogins.id, site: vaultLogins.site });
};

export const saveLogin = (owner: string, { site, ...login }: z.infer<typeof vaultLogin>) =>
  keep(owner, "login", site, login);

export const connectOnePassword = async (owner: string, token: string) => {
  await checkToken(token).catch(() => {
    throw new StatusError(400, "1Password didn't accept that service account token.");
  });
  await keep(owner, "onepassword", ONE_PASSWORD_SITE, { token });
};

const rowsOf = (owner: string) =>
  db
    .select({
      id: vaultLogins.id,
      kind: vaultLogins.kind,
      site: vaultLogins.site,
      sealed: vaultLogins.sealed,
    })
    .from(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), inArray(vaultLogins.kind, ["login", "onepassword"])))
    .orderBy(vaultLogins.site);

export const listVault = async (owner: string) => {
  const [rows, contacts] = await Promise.all([rowsOf(owner), listContacts(owner)]);
  const logins = await Promise.all(
    rows
      .filter(({ kind }) => kind === "login")
      .map(async ({ id, site, sealed }) => {
        const { username, code } = await opened(sealedLogin, { owner, site, sealed });
        return { id, site, username, twoStep: code !== undefined };
      }),
  );
  return { logins, onePassword: rows.some(({ kind }) => kind === "onepassword"), contacts };
};

export const removeFromVault = async (owner: string, id: string) => {
  const removed = await db
    .delete(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.id, id)))
    .returning({ id: vaultLogins.id });
  if (removed.length === 0) throw new StatusError(404, "no such vault item");
};

export const disconnectOnePassword = (owner: string) =>
  db
    .delete(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.kind, "onepassword")));

export const loginFor = async (owner: string, rawHost: string) => {
  const host = rawHost.replace(/^www\./u, "");
  const rows = await rowsOf(owner);
  const saved = rows
    .filter(({ kind, site }) => kind === "login" && isOnSite(host, site))
    .toSorted((a, b) => b.site.length - a.site.length)[0];
  if (saved) {
    const { username, password, code } = await opened(sealedLogin, { owner, ...saved });
    return {
      source: "vault" as const,
      site: saved.site,
      username,
      password,
      code: code === undefined ? undefined : totp(code),
    };
  }
  const connection = rows.find(({ kind }) => kind === "onepassword");
  if (!connection) return undefined;
  const { token } = await opened(sealedToken, { owner, ...connection });
  const found = await onePasswordLogin(token, host);
  return found && { source: "1password" as const, ...found };
};
