import { db } from "@sirathic/db";
import { vaultLogins } from "@sirathic/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { StatusError } from "../http";
import { COUNTRY_CODES } from "../shared/countries";
import { seal, unseal } from "./seal";
import { refuseTaken } from "./taken";

export const contactLabel = z.string().trim().min(1).max(40);

export const vaultContact = z
  .object({
    label: contactLabel,
    fullName: z.string().trim().max(200).optional(),
    address: z.string().trim().max(300).optional(),
    address2: z.string().trim().max(300).optional(),
    city: z.string().trim().max(100).optional(),
    region: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(32).optional(),
    country: z.string().trim().pipe(z.enum(COUNTRY_CODES)).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.union([z.email(), z.literal("")]))
      .optional(),
  })
  .refine(({ label: _label, ...parts }) => Object.values(parts).some(Boolean), {
    message: "Fill at least one contact field besides the label.",
  })
  .refine((contact) => new TextEncoder().encode(JSON.stringify(contact)).byteLength <= 4_096, {
    message: "Contact info is too long to store.",
  });

const siteOf = (label: string) => `contact:${label.trim().toLowerCase()}`;

export const saveContact = async (owner: string, contact: z.infer<typeof vaultContact>) => {
  const parsed = vaultContact.parse(contact);
  const site = siteOf(parsed.label);
  const sealed = await seal(JSON.stringify(parsed), owner, site);
  const [added] = await db
    .insert(vaultLogins)
    .values({ owner, kind: "contact", site, sealed })
    .onConflictDoNothing({ target: [vaultLogins.owner, vaultLogins.site] })
    .returning({ id: vaultLogins.id });
  if (!added) throw new StatusError(409, "a contact with this label is already saved");
  return added;
};

export const updateContact = async (
  owner: string,
  id: string,
  contact: z.infer<typeof vaultContact>,
) => {
  const site = siteOf(contact.label);
  const sealed = await seal(JSON.stringify(contact), owner, site);
  const updated = await db
    .update(vaultLogins)
    .set({ site, sealed })
    .where(
      and(eq(vaultLogins.owner, owner), eq(vaultLogins.id, id), eq(vaultLogins.kind, "contact")),
    )
    .returning({ id: vaultLogins.id })
    .catch(refuseTaken("a contact with this label is already saved"));
  if (updated.length === 0) throw new StatusError(404, "no such vault item");
};

export const listContacts = async (owner: string) => {
  const rows = await db
    .select({ id: vaultLogins.id, site: vaultLogins.site, sealed: vaultLogins.sealed })
    .from(vaultLogins)
    .where(and(eq(vaultLogins.owner, owner), eq(vaultLogins.kind, "contact")))
    .orderBy(vaultLogins.site);
  return Promise.all(
    rows.map(async ({ id, site, sealed }) => {
      const { label, fullName } = vaultContact.parse(JSON.parse(await unseal(sealed, owner, site)));
      return { id, label, fullName };
    }),
  );
};

export const contactFor = async (owner: string, label: string) => {
  const site = siteOf(label);
  const [row] = await db
    .select({ sealed: vaultLogins.sealed })
    .from(vaultLogins)
    .where(
      and(
        eq(vaultLogins.owner, owner),
        eq(vaultLogins.kind, "contact"),
        eq(vaultLogins.site, site),
      ),
    )
    .limit(1);
  return row && vaultContact.parse(JSON.parse(await unseal(row.sealed, owner, site)));
};
