import { clickInput } from "@sirathic/browser/protocol";
import { siteHost } from "@sirathic/core/web/url";
import { tool } from "ai";
import { z } from "zod";
import { contactFor, contactLabel, listContacts, vaultContact } from "../vault/contacts";
import type { fillBrowser } from "./browser";
import type { BotScope } from "./tools";

export const VAULT_FILL_CONTACT = "vault_fill_contact";

const FIELDS_PER_FILL = 8;

const contactInput = z.object({
  domain: siteHost.describe("The site's domain from the latest page snapshot."),
  label: contactLabel.optional(),
  fields: z
    .array(clickInput.extend({ part: vaultContact.keyof().exclude(["label"]) }))
    .min(1)
    .max(9)
    .refine((fields) => new Set(fields.map(({ target }) => target)).size === fields.length),
});

const fillContact = async (
  { id, owner }: BotScope,
  fill: typeof fillBrowser,
  { domain, label, fields }: z.infer<typeof contactInput>,
) => {
  const contacts = await listContacts(owner);
  if (contacts.length === 0) {
    return {
      kind: "missing" as const,
      note: "No contact info is saved in the vault. Send request_user_form instead.",
    };
  }
  if (label === undefined && contacts.length > 1) {
    return { kind: "choose" as const, labels: contacts.map((contact) => contact.label) };
  }
  const chosen = label ?? contacts[0]?.label;
  const contact = chosen === undefined ? undefined : await contactFor(owner, chosen);
  if (!contact) {
    return {
      kind: "missing" as const,
      note: "No contact info is saved with that label. Ask which contact to use or send request_user_form.",
    };
  }
  const empty = fields.filter(({ part }) => !contact[part]).map(({ part }) => part);
  const targets = fields.flatMap(({ part, target }) => {
    const value = contact[part];
    return value ? [{ part, target, value }] : [];
  });
  const batches = Array.from({ length: Math.ceil(targets.length / FIELDS_PER_FILL) }, (_, index) =>
    targets.slice(index * FIELDS_PER_FILL, (index + 1) * FIELDS_PER_FILL),
  );
  const receipts = await Promise.all(
    batches.map((batch) =>
      fill(id, {
        domain,
        fields: batch.map(({ target, value }) => ({ target, value })),
        submit: false,
      }).catch(() => undefined),
    ),
  );
  const outcomes = new Map(
    receipts.flatMap((receipt) =>
      (receipt?.fields ?? []).map(({ target, filled }) => [target, filled] as const),
    ),
  );
  return {
    kind: "filled" as const,
    filled: targets.filter(({ target }) => outcomes.get(target)).map(({ part }) => part),
    empty,
    failed: targets
      .filter(({ target }) => !outcomes.get(target))
      .map(({ part, target }) => ({ part, target })),
  };
};

export function contactTools(scope: BotScope, fill: typeof fillBrowser) {
  return {
    [VAULT_FILL_CONTACT]: tool({
      description:
        "Fills contact info the user saved in their vault straight into the page your browser has open. Use it first when a page asks for a name, address, phone or email. Take a fresh snapshot first, give its site's domain and give each field its target ref, including embedded fields. Omit label to use the only saved contact, or get just the labels when there is a choice and ask the user which to use. Ask in chat or send request_user_form only for what the contact lacks. Values never reach you: you receive only which parts were filled, which were empty and which targets failed. This only fills, without submitting. Take a fresh snapshot afterward, then use the site's own continue button.",
      inputSchema: contactInput,
      execute: (input) => fillContact(scope, fill, input),
    }),
  };
}
