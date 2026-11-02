"use client";

import { DetailRows } from "@/components/approvalPrompt";
import { useT } from "@/components/i18n";
import { useCountries } from "@/components/settingsVaultForms";
import { api } from "@/lib/trpc";
import type { MessageKey } from "@/messages/en";
import { type FC, useEffect, useState } from "react";
import { z } from "zod";

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

const PART_NAMES = {
  fullName: "Full name",
  address: "Address",
  address2: "Address line 2",
  city: "City",
  region: "State or region",
  postalCode: "ZIP or postal code",
  country: "Country",
  phone: "Phone",
  email: "Email address",
} as const satisfies Record<(typeof PARTS)[number], MessageKey>;

export const vaultFill = z.object({
  domain: z.string(),
  label: z.string(),
  fields: z.array(z.object({ part: z.enum(PARTS) })),
});

const loadContact = async (label: string) => {
  const { contacts } = await api.vault.list.query();
  const found = contacts.find(
    (contact) => contact.label.trim().toLowerCase() === label.trim().toLowerCase(),
  );
  const item = found ? await api.vault.open.query({ id: found.id }) : undefined;
  return item?.kind === "contact" ? item : null;
};

type Contact = Awaited<ReturnType<typeof loadContact>>;

export const VaultFillDetails: FC<{ fill: z.infer<typeof vaultFill> }> = ({ fill }) => {
  const t = useT();
  const countries = useCountries();
  const [contact, setContact] = useState<Contact | undefined>();
  useEffect(() => {
    void loadContact(fill.label).then(setContact, () => setContact(null));
  }, [fill.label]);

  const rows = fill.fields.map(({ part }) => {
    const value = contact?.[part] ?? "";
    const shown =
      part === "country" ? (countries.find(({ code }) => code === value)?.name ?? value) : value;
    return [t(PART_NAMES[part]), contact === undefined ? "…" : shown || "-"] as const;
  });
  return <DetailRows rows={rows} />;
};
