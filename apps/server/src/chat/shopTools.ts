import { tool } from "ai";
import { z } from "zod";
import { httpsUrl, product } from "../shared/cards";
import { fenced } from "./fence";

const CATALOG = "https://catalog.shopify.com/api/ucp/mcp";
const PROFILE = "https://sirathic.com/ucp/agent-profile.json";
const TIMEOUT_MS = 20_000;
const DESCRIPTION_CHARS = 300;
const NO_OPTION = "Default Title";

const money = z.object({ amount: z.number(), currency: z.string() });
const media = z.array(z.object({ url: httpsUrl })).optional();
const chosen = z.array(z.object({ name: z.string().max(100), label: z.string().max(200) }));

const listed = z.object({
  id: z.string(),
  title: z.string(),
  description: z.object({ plain: z.string().optional() }).optional(),
  rating: z.object({ value: z.number(), count: z.number().optional() }).optional(),
  media,
  variants: z
    .array(
      z.object({
        url: httpsUrl,
        checkout_url: httpsUrl.optional(),
        price: money,
        list_price: money.optional(),
        media,
        availability: z.object({ available: z.boolean() }).optional(),
        seller: z.object({ name: z.string(), url: httpsUrl.optional() }),
      }),
    )
    .min(1),
});

const detailed = listed.extend({
  options: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(
          z.object({
            label: z.string(),
            available: z.boolean().optional(),
            exists: z.boolean().optional(),
          }),
        ),
      }),
    )
    .optional(),
  selected: chosen.optional(),
  metadata: z.object({ tech_specs: z.array(z.string()).optional() }).optional(),
});

const envelope = z.union([
  z.object({
    result: z.object({
      isError: z.literal(true),
      content: z.array(z.object({ text: z.string() })),
    }),
  }),
  z.object({ result: z.object({ structuredContent: z.json() }) }),
  z.object({ error: z.object({ message: z.string() }) }),
]);

const searchResult = z.object({ products: z.array(z.json()) });

const country = z.string().regex(/^[A-Z]{2}$/u);

const shopInput = z.object({
  query: z.string().min(1).max(200).describe("What the buyer is looking for, in a few words."),
  country: country
    .optional()
    .describe(
      "The buyer's country as a two-letter code, like SI, so only stores that ship there show, in local prices.",
    ),
  limit: z.number().int().min(1).max(20).optional().describe("How many products, 10 by default."),
});

export const productQuery = z.object({
  id: z.string().startsWith("gid://shopify/").max(200),
  selected: chosen.max(10).optional(),
  country: country.optional(),
});

type CatalogRequest = {
  query?: string;
  id?: string;
  selected?: z.infer<typeof chosen>;
  context?: { address_country: string };
  filters?: { ships_to: { country: string } };
  pagination?: { limit: number };
};

const catalogCall = async <Content extends z.ZodType>(
  name: string,
  catalog: CatalogRequest,
  content: Content,
): Promise<z.infer<Content>> => {
  const response = await fetch(CATALOG, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { meta: { "ucp-agent": { profile: PROFILE } }, catalog } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const found = envelope.parse(await response.json());
  if ("error" in found) throw new Error(found.error.message);
  if ("isError" in found.result)
    throw new Error(found.result.content[0]?.text ?? `${name} failed.`);
  return content.parse(found.result.structuredContent);
};

const buyerIn = (where: string | undefined) =>
  where ? { context: { address_country: where }, filters: { ships_to: { country: where } } } : {};

const majorUnits = ({ amount, currency }: z.infer<typeof money>) =>
  amount /
  10 **
    (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2);

const plainText = (html: string) =>
  html
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll(/\s+/gu, " ")
    .trim();

const productOf = (row: z.infer<typeof listed>, where: string | undefined) => {
  const [variant] = row.variants;
  return product.parse({
    id: row.id,
    url: variant.url,
    title: row.title,
    price: majorUnits(variant.price),
    currency: variant.price.currency,
    listPrice: variant.list_price && majorUnits(variant.list_price),
    rating: row.rating?.value,
    reviews: row.rating?.count,
    imageUrl: (variant.media ?? row.media)?.[0]?.url,
    store: variant.seller.name,
    storeUrl: variant.seller.url,
    country: where,
  });
};

export const productsIn = (found: z.infer<typeof searchResult>, where?: string) =>
  found.products.flatMap((row) => {
    const parsed = listed.safeParse(row).data;
    return parsed
      ? [
          {
            ...productOf(parsed, where),
            available: parsed.variants[0].availability?.available,
            description: parsed.description?.plain
              ? plainText(parsed.description.plain).slice(0, DESCRIPTION_CHARS)
              : undefined,
          },
        ]
      : [];
  });

export const productDetail = async ({
  id,
  selected,
  country: where,
}: z.infer<typeof productQuery>) => {
  const found = await catalogCall(
    "get_product",
    { id, ...(selected && { selected }), ...buyerIn(where) },
    z.object({ product: detailed }),
  );
  const parsed = found.product;
  const [variant] = parsed.variants;
  return {
    ...productOf(parsed, where),
    description: plainText(parsed.description?.plain ?? ""),
    checkoutUrl: variant.checkout_url,
    available: variant.availability?.available ?? true,
    options: (parsed.options ?? []).filter(
      ({ values }) => values.length > 1 || values[0]?.label !== NO_OPTION,
    ),
    selected: (parsed.selected ?? []).filter(({ label }) => label !== NO_OPTION),
    specs: parsed.metadata?.tech_specs ?? [],
  };
};

export const shopTools = (found: (rows: z.infer<typeof product>[]) => void) => ({
  shop_search: tool({
    description:
      "Search for products across many Shopify stores, each sold by the brand's own shop. Use this when the user is looking for products without naming a store, like 'a pair of running shoes', 'wireless headphones under $100' or 'organic coffee beans'. Returns each product's id, page, price, rating, review count and store.",
    inputSchema: shopInput,
    execute: async ({ query, country: where, limit }) => {
      const rows = productsIn(
        await catalogCall(
          "search_catalog",
          { query, ...buyerIn(where), pagination: { limit: limit ?? 10 } },
          searchResult,
        ),
        where,
      );
      found(rows);
      return { products: rows };
    },
    toModelOutput: ({ output }) => fenced({ type: "json", value: output }),
  }),
});
