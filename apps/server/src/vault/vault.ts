import { db } from "@sirathic/db";
import { vaultLogins } from "@sirathic/db/schema";
import { isOnSite, siteHost } from "@sirathic/core/web/url";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { listContacts, vaultContact } from "./contacts";
import { seal, unseal } from "./seal";
import { setupKey, totp } from "./totp";

export const vaultLogin = z.object({
  site: siteHost,
  username: z.string().trim().min(1).max(200).optional(),
  password: z.string().min(1).max(500),
  notes: z.string().trim().min(1).max(2_000).optional(),
  code: setupKey.optional(),
});

const sealedLogin = vaultLogin.omit({ site: true });

const opened = async <Schema extends z.ZodType>(
  schema: Schema,
  { owner, site, sealed }: { owner: string; site: string; sealed: string },
) => schema.parse(JSON.parse(await unseal(sealed, owner, site)));

export const saveLogin = async (owner: string, { site, ...login }: z.infer<typeof vaultLogin>) => {
  const sealed = await seal(JSON.stringify(login), owner, site);
  return db
    .insert(vaultLogins)
    .values({ owner, kind: "login", site, sealed })
    .onConflictDoUpdate({ target: [vaultLogins.owner, vaultLogins.site], set: { sealed } })
    .returning({ id: vaultLogins.id, site: vaultLogins.site });
};

const rowsOf = (owner: string) =>
  db
    .select({ id: vaultLogins.id, site: vaultLogins.site, sealed: vaultLogins.sealed })
    .from(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.kind, "login")))
    .orderBy(vaultLogins.site);

export const listVault = async (owner: string) => {
  const [rows, contacts] = await Promise.all([rowsOf(owner), listContacts(owner)]);
  const logins = await Promise.all(
    rows.map(async ({ id, site, sealed }) => {
      const { username, notes, code } = await opened(sealedLogin, { owner, site, sealed });
      return { id, site, username, notes, twoStep: code !== undefined };
    }),
  );
  return { logins, contacts };
};

const rowOf = async (owner: string, id: string) => {
  const [row] = await db
    .select({ kind: vaultLogins.kind, site: vaultLogins.site, sealed: vaultLogins.sealed })
    .from(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.id, id)))
    .limit(1);
  if (!row) throw new StatusError(404, "no such vault item");
  return row;
};

export const openItem = async (owner: string, id: string) => {
  const { kind, site, sealed } = await rowOf(owner, id);
  switch (kind) {
    case "login": {
      const { username, password, notes } = await opened(sealedLogin, { owner, site, sealed });
      return { kind, id, site, username, password, notes };
    }
    case "contact":
      return { kind, id, ...(await opened(vaultContact, { owner, site, sealed })) };
  }
};

export const updateLogin = async (
  owner: string,
  id: string,
  { site, ...login }: z.infer<typeof vaultLogin>,
) => {
  const before = await rowOf(owner, id);
  if (before.kind !== "login") throw new StatusError(404, "no such vault item");
  const { code } = await opened(sealedLogin, { owner, ...before });
  const sealed = await seal(JSON.stringify({ ...login, code: login.code ?? code }), owner, site);
  await db
    .update(vaultLogins)
    .set({ site, sealed })
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.id, id)));
};

export const removeFromVault = async (owner: string, id: string) => {
  const removed = await db
    .delete(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.id, id)))
    .returning({ id: vaultLogins.id });
  if (removed.length === 0) throw new StatusError(404, "no such vault item");
};

export const loginFor = async (owner: string, rawHost: string) => {
  const host = rawHost.replace(/^www\./u, "");
  const rows = await rowsOf(owner);
  const saved = rows
    .filter(({ site }) => isOnSite(host, site))
    .toSorted((a, b) => b.site.length - a.site.length)[0];
  if (!saved) return undefined;
  const { username, password, code } = await opened(sealedLogin, { owner, ...saved });
  return {
    site: saved.site,
    username,
    password,
    code: code === undefined ? undefined : totp(code),
  };
};
