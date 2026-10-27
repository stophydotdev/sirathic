import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";
import { type WebSearchResult, webSearchResult } from "../web/types";
import { cleanUrl, hostOf, isOnSite, siteHost } from "../web/url";

const DEFAULT_LIMIT = 10;
const EXCLUDED_SITES = ["islamweb.net"];

const searchCache = cacheFor({
  namespace: "search:v4",
  schema: webSearchResult.array(),
  freshMs: 6 * 60 * 60_000,
  keepMs: 7 * 24 * 60 * 60_000,
});

const matchesSites = (url: string, sites: string[]) =>
  sites.length === 0 || sites.some((site) => isOnSite(hostOf(url), site));

const stophyResults = z.object({
  results: z.array(
    z.object({
      type: z.string().default("web"),
      url: z.string(),
      title: z.string(),
      description: z.string().optional(),
      markdown: z.string().optional(),
    }),
  ),
});

const search = async ({ query, sites, time, read }: z.infer<typeof webSearchInput>) => {
  const { data } = await stophy.web.search({
    query,
    ...(sites.length > 0
      ? { includeDomains: sites }
      : { safeSearch: true, excludeDomains: EXCLUDED_SITES }),
    time,
    ...(read > 0 && { scrapeResults: true, scrapeLimit: read }),
  });
  const seen = new Set<string>();
  const found = stophyResults.parse(data).results;
  const results = found.flatMap((result): WebSearchResult[] => {
    if (result.type !== "web") return [];
    const url = cleanUrl(result.url);
    const excluded = EXCLUDED_SITES.some((site) => isOnSite(hostOf(url), site));
    if (excluded || seen.has(url) || !matchesSites(url, sites)) return [];
    seen.add(url);
    const markdown = result.markdown?.trim();
    return [
      {
        url,
        title: result.title,
        description: result.description ?? "",
        ...(markdown && { markdown }),
      },
    ];
  });
  if (results.length === 0) throw new Error("Web search found no results");
  return results;
};

export const webSearchInput = z.object({
  query: z.string().min(1),
  sites: z.array(siteHost).max(5).default([]),
  time: z.enum(["pastWeek", "pastMonth", "pastYear"]).optional(),
  limit: z.number().int().min(1).max(20).default(DEFAULT_LIMIT),
  read: z.number().int().min(0).max(5).default(0),
});

export const webSearch = async (
  input: z.input<typeof webSearchInput>,
): Promise<WebSearchResult[]> => {
  const request = webSearchInput.parse(input);
  const { limit } = request;
  const key = [
    request.time ?? "",
    request.sites.join(","),
    request.read,
    request.query.trim().replaceAll(/\s+/gu, " ").toLowerCase(),
  ].join("|");
  const results = await searchCache(key, () => search(request));
  return results.slice(0, limit);
};
