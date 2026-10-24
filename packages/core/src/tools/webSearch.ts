import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";
import { type WebSearchResult, webSearchResult } from "../web/types";
import { cleanUrl, hostOf, isOnSite } from "../web/url";

const DEFAULT_LIMIT = 10;
const SITE_FILTER = /(?:^|[\s(])site:([^\s)]+)/giu;
const EXCLUDED_SITES = ["islamweb.net"];

const searchCache = cacheFor({
  namespace: "search:v3",
  schema: webSearchResult.array(),
  freshMs: 6 * 60 * 60_000,
  keepMs: 7 * 24 * 60 * 60_000,
});

const sitesIn = (query: string) =>
  [...query.matchAll(SITE_FILTER)].map(([, site = ""]) => {
    const [host = "", ...path] = site.toLowerCase().split("/");
    return { host: host.replace(/^www\./u, ""), path: `/${path.join("/")}` };
  });

const matchesSites = (url: string, sites: ReturnType<typeof sitesIn>) =>
  sites.length === 0 ||
  sites.some(
    (site) => isOnSite(hostOf(url), site.host) && new URL(url).pathname.startsWith(site.path),
  );

const stophyResults = z.object({
  results: z.array(
    z.object({
      type: z.string().default("web"),
      url: z.string(),
      title: z.string(),
      description: z.string().optional(),
    }),
  ),
});

const search = async (query: string) => {
  const sites = sitesIn(query);
  const { data } = await stophy.web.search({
    query,
    safeSearch: true,
    excludeDomains: EXCLUDED_SITES,
  });
  const seen = new Set<string>();
  const found = stophyResults.parse(data).results;
  const results = found.flatMap((result): WebSearchResult[] => {
    if (result.type !== "web") return [];
    const url = cleanUrl(result.url);
    const excluded = EXCLUDED_SITES.some((site) => isOnSite(hostOf(url), site));
    if (excluded || seen.has(url) || !matchesSites(url, sites)) return [];
    seen.add(url);
    return [{ url, title: result.title, description: result.description ?? "" }];
  });
  if (results.length === 0) throw new Error("Web search found no results");
  return results;
};

export const webSearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
});

export const webSearch = async ({
  query,
  limit = DEFAULT_LIMIT,
}: z.infer<typeof webSearchInput>): Promise<WebSearchResult[]> => {
  const key = query.trim().replaceAll(/\s+/gu, " ").toLowerCase();
  const results = await searchCache(key, () => search(query));
  return results.slice(0, limit);
};
