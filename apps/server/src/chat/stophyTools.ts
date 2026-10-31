import { clip, stophy } from "@sirathic/core/stophy";
import { env } from "@sirathic/env/server";
import { tool } from "ai";
import { z } from "zod";
import { wordsOf } from "../plugins/tools";
import type { Source } from "../shared/sources";
import type { Cite } from "./cite";
import { fenced } from "./fence";
import { videoOfRow, withVideos } from "./youtube";

const API = "https://api.stophy.dev";
const MAX_MATCHES = 8;
const MAX_ROWS = 20;
const TIMEOUT_MS = 60_000;
const RESULT_CHARS = 60_000;
const SNIPPET_CHARS = 300;
const PAGE_KEY = /^(?:url|\w+Url)$/u;
const NOT_A_PAGE = /image|thumbnail|avatar|icon|photo|logo/iu;

export const STOPHY_TOOLS = ["stophy_search_endpoints", "stophy_call"];

export const STOPHY_LINK =
  /https?:\/\/(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|x\.com|twitter\.com|reddit\.com|pinterest\.[a-z.]+|pin\.it|linkedin\.com|threads\.(?:net|com)|tripadvisor\.[a-z.]+|trustpilot\.com|upwork\.com|indeed\.[a-z.]+|amazon\.[a-z.]+|amzn\.to|ebay\.[a-z.]+|zillow\.com|realtor\.com|craigslist\.org|airbnb\.[a-z.]+|booking\.com|expedia\.[a-z.]+|lu\.ma|luma\.com|apps\.apple\.com|play\.google\.com|maps\.google\.[a-z.]+|maps\.app\.goo\.gl)\/|https?:\/\/(?:www\.)?google\.[a-z.]+\/(?:maps|travel)/iu;

const json = z.json();
const row = z.record(z.string(), json);
const listed = z.object({ results: z.array(row) }).catchall(json);
const textField = z.string();
const pageUrl = z.url({ protocol: /^https?$/u });

export type Row = z.infer<typeof row>;

const pageOf = (entry: Row) =>
  Object.entries(entry).flatMap(([key, value]) => {
    const url = PAGE_KEY.test(key) && !NOT_A_PAGE.test(key) && pageUrl.safeParse(value).data;
    return url ? [url] : [];
  })[0];

const withCitations = (cite: Cite, data: z.infer<typeof json>, fallbackTitle: string) => {
  const sources: Source[] = [];
  const cited = (entry: Row): Row => {
    const url = pageOf(entry);
    if (!url) return entry;
    const title = textField.safeParse(entry.title ?? entry.name).data ?? fallbackTitle;
    const snippet =
      textField.safeParse(entry.description ?? entry.summary ?? entry.address ?? entry.text).data ??
      "";
    sources.push({
      url,
      title,
      snippet: clip(snippet, SNIPPET_CHARS),
      video: videoOfRow(url, entry),
    });
    return { citation: cite(url), ...entry };
  };
  const list = listed.safeParse(data);
  const one = row.safeParse(data);
  const hidden = list.success ? list.data.results.length - MAX_ROWS : 0;
  const marked = list.success
    ? {
        ...cited(list.data),
        results: list.data.results.slice(0, MAX_ROWS).map(cited),
        ...(hidden > 0 && {
          more: `${hidden} more results not shown. Narrow the input to see others.`,
        }),
      }
    : one.success
      ? cited(one.data)
      : data;
  return { data: marked, sources };
};

type Catalog = Awaited<ReturnType<typeof stophy.endpoints>>;

const sourceKinds = z.object({
  sources: z.array(z.object({ id: z.string(), kind: z.string().optional() })),
});

const withoutAiAnswers = (found: Catalog): Catalog => {
  const hidden = new Set(
    sourceKinds.parse(found).sources.flatMap(({ id, kind }) => (kind === "aiAnswers" ? [id] : [])),
  );
  return {
    sources: found.sources.filter(({ id }) => !hidden.has(id)),
    endpoints: found.endpoints.filter(({ id }) => !hidden.has(id.split(".")[0] ?? id)),
  };
};

let catalog: Promise<Catalog> | undefined;

const loadCatalog = () =>
  (catalog ??= stophy
    .endpoints()
    .then(withoutAiAnswers)
    .catch((err: Error) => {
      catalog = undefined;
      throw err;
    }));

const searchInput = z.object({
  query: z
    .string()
    .max(200)
    .optional()
    .describe('What you want in plain words, such as "restaurant reviews in Austin".'),
  category: z.string().optional().describe("Source name, such as reddit or youtube."),
});

const callInput = z.object({
  id: z.string().min(1).describe("Endpoint id from stophy_search_endpoints."),
  input: z
    .record(z.string(), json)
    .optional()
    .describe("JSON body for that endpoint. Omit keys you are not setting."),
  maxTextLength: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Cut each text value to this many characters. Omit it for full text."),
});

const reply = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: json, creditsUsed: z.number() }),
  z.object({ success: z.literal(false), error: z.object({ message: z.string() }) }),
]);

const singular = (word: string) => word.replace(/s$/u, "");

const matchingEndpoints = (
  { sources, endpoints }: Catalog,
  { query, category }: z.infer<typeof searchInput>,
) => {
  const named = sources.find(
    ({ id, name }) =>
      category !== undefined && [id, name.toLowerCase()].includes(category.toLowerCase()),
  );
  const wanted = wordsOf(`${query ?? ""} ${named ? "" : (category ?? "")}`)
    .filter((word) => word.length > 2)
    .map(singular);
  if (wanted.length === 0 && !named) return { endpoints: [], sources };
  const described = endpoints.map((endpoint) => {
    const source = sources.find(({ id }) => id === endpoint.id.split(".")[0]);
    const text = `${source?.name} ${endpoint.id} ${endpoint.title} ${endpoint.summary} ${endpoint.bestWhen ?? ""}`;
    return { endpoint, source, words: new Set(wordsOf(text).map(singular)) };
  });
  const rarity = (word: string) =>
    Math.log(
      described.length / Math.max(1, described.filter(({ words }) => words.has(word)).length),
    );
  const matches = described
    .filter(({ source }) => !named || named === source)
    .map(({ endpoint, source, words }) => ({
      endpoint,
      source,
      score: wanted.reduce((sum, word) => sum + (words.has(word) ? rarity(word) : 0), 0),
    }))
    .filter(({ score }) => wanted.length === 0 || score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, wanted.length === 0 ? undefined : MAX_MATCHES)
    .map(({ endpoint, source }) => ({
      id: endpoint.id,
      title: endpoint.title,
      source: source?.name,
      description: endpoint.summary,
      bestWhen: endpoint.bestWhen,
      credits: endpoint.credits,
      maxCredits: endpoint.maxCredits,
      input: endpoint.input,
      example: endpoint.example,
    }));
  return matches.length > 0 ? { endpoints: matches } : { endpoints: [], sources };
};

export const stophyTools = (cite: Cite) => ({
  stophy_search_endpoints: tool({
    description:
      "Use this first when the user wants live data from the web: search, video, social, places, jobs, shopping, homes, events, apps, travel or ads. Returns matches with inputs, filters and cost, ready for stophy_call.",
    inputSchema: searchInput,
    execute: async (input) => matchingEndpoints(await loadCatalog(), input),
  }),
  stophy_call: tool({
    description: "Get the data from the endpoint you chose, with the credits used.",
    inputSchema: callInput,
    execute: async ({ id, input, maxTextLength }) => {
      const endpoint = (await loadCatalog()).endpoints.find((entry) => entry.id === id);
      if (!endpoint) throw new Error(`No endpoint ${id}. Find one with stophy_search_endpoints.`);
      const url = new URL(endpoint.path, API);
      if (maxTextLength) url.searchParams.set("maxTextLength", String(maxTextLength));
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          authorization: `Bearer ${env.STOPHY_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input ?? {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = reply.parse(await response.json());
      if (!body.success) throw new Error(body.error.message);
      const marked = withCitations(cite, body.data, endpoint.title);
      return {
        ...marked,
        sources: await withVideos(marked.sources),
        creditsUsed: body.creditsUsed,
      };
    },
    toModelOutput: ({ output: { data, creditsUsed } }) =>
      fenced({ type: "text", value: clip(JSON.stringify({ data, creditsUsed }), RESULT_CHARS) }),
  }),
});
