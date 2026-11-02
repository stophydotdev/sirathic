import { toolName } from "@sirathic/server/catalog";
import { VAULT_FILL_CONTACT } from "@sirathic/server/confirm";
import { outgoingEmail } from "@sirathic/server/email";
import { z } from "zod";
import type { toolOf } from "./research";

export type Tool = NonNullable<ReturnType<typeof toolOf>>;

const PARTS = [
  "fullName",
  "address",
  "address2",
  "city",
  "region",
  "postalCode",
  "country",
  "phone",
  "email",
] as const;

export const PART_NAMES = {
  fullName: "Full name",
  address: "Address",
  address2: "Address line 2",
  city: "City",
  region: "State or region",
  postalCode: "ZIP or postal code",
  country: "Country",
  phone: "Phone",
  email: "Email address",
} as const satisfies Record<(typeof PARTS)[number], string>;

export const vaultFill = z.object({
  domain: z.string(),
  label: z.string(),
  fields: z.array(z.object({ part: z.enum(PARTS) })),
});

const GMAIL_SEND = toolName("gmail", "send_email");

export const fillOf = (tool: Tool) =>
  tool.name === VAULT_FILL_CONTACT ? vaultFill.safeParse(tool.input).data : undefined;

export const emailOf = (tool: Tool) =>
  tool.name === GMAIL_SEND ? outgoingEmail.safeParse(tool.input).data : undefined;

export const docked = (tool: Tool) =>
  tool.approval !== undefined &&
  !tool.approval.isAutomatic &&
  tool.approval.approved === undefined &&
  emailOf(tool) === undefined;

export const titleOf = (name: string) => {
  const spaced = name
    .replaceAll(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replaceAll(/[_-]+/gu, " ")
    .toLowerCase();
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};
