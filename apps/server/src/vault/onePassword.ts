import type { Item, ItemFieldType } from "@1password/sdk";
import { isOnSite } from "@sirathic/core/web/url";

const INTEGRATION = { integrationName: "Sirathic", integrationVersion: "1.0.0" };

const clientOf = async (token: string) =>
  (await import("@1password/sdk")).createClient({ auth: token, ...INTEGRATION });

const hostOf = (url: string) =>
  URL.parse(url.includes("://") ? url : `https://${url}`)?.hostname.replace(/^www\./u, "") ?? "";

export const checkToken = async (token: string) => {
  await (await clientOf(token)).vaults.list();
};

const fieldOf = (item: Item, id: string, type: ItemFieldType) =>
  item.fields.find((field) => field.id === id)?.value ??
  item.fields.find((field) => field.fieldType === type)?.value;

export const onePasswordLogin = async (token: string, host: string) => {
  const { ItemFieldType } = await import("@1password/sdk");
  const client = await clientOf(token);
  const vaults = await client.vaults.list();
  const overviews = (await Promise.all(vaults.map((vault) => client.items.list(vault.id)))).flat();
  const match = overviews
    .flatMap((overview) =>
      overview.websites
        .map(({ url }) => hostOf(url))
        .filter((site) => site !== "" && isOnSite(host, site))
        .map((site) => ({ overview, site })),
    )
    .toSorted((a, b) => b.site.length - a.site.length)[0];
  if (!match) return undefined;
  const item = await client.items.get(match.overview.vaultId, match.overview.id);
  const username = fieldOf(item, "username", ItemFieldType.Text);
  const password = fieldOf(item, "password", ItemFieldType.Concealed);
  if (!username || !password) return undefined;
  const otp = item.fields.find((field) => field.fieldType === ItemFieldType.Totp)?.details;
  return {
    site: match.site,
    username,
    password,
    code: otp?.type === "Otp" ? otp.content.code : undefined,
  };
};
