import { cached } from "@/lib/cache";
import { webFetch } from "@/lib/webFetch";
import { webSearch } from "@/lib/webSearch";
import { Chunk } from "@/lib/types";
import { AdditionalConfig } from "../../types";

const SEARCH_TTL_MS = 30 * 60 * 1000;
const PAGE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE_CHARS = 6000;
const SCRAPE_TIMEOUT_MS = 20_000;

export const executeScopedSearch = async (input: {
  queries: string[];
  siteScope: string;
  scrapeTop: number;
  additionalConfig: AdditionalConfig;
  filterUrl?: (url: string) => boolean;
}): Promise<Chunk[]> => {
  const queries = (
    Array.isArray(input.queries) ? input.queries : [input.queries]
  ).slice(0, 3);

  input.additionalConfig.emitSubStep({
    type: "searching",
    queries: queries.map((q) => `${input.siteScope} ${q}`),
  });

  const snippets: Chunk[] = [];

  await Promise.all(
    queries.map(async (q) => {
      const scopedQuery = `${input.siteScope} ${q}`;

      const res = await cached(`search:${scopedQuery}`, SEARCH_TTL_MS, () =>
        webSearch(scopedQuery, { limit: 5 }),
      );

      snippets.push(
        ...res.map((r) => ({
          content: r.description || r.title,
          metadata: {
            title: r.title,
            url: r.url,
          },
        })),
      );
    }),
  );

  const seenUrls = new Set<string>();
  const uniqueSnippets = snippets.filter((r) => {
    if (input.filterUrl && !input.filterUrl(r.metadata.url)) return false;
    if (seenUrls.has(r.metadata.url)) return false;
    seenUrls.add(r.metadata.url);
    return true;
  });

  const toScrape = uniqueSnippets
    .filter((r) => !input.additionalConfig.scrapedUrls.has(r.metadata.url))
    .slice(0, input.scrapeTop);

  toScrape.forEach((r) =>
    input.additionalConfig.scrapedUrls.add(r.metadata.url),
  );

  if (toScrape.length > 0) {
    input.additionalConfig.emitSubStep({
      type: "reading",
      urls: toScrape.map((r) => r.metadata.url),
    });
  }

  const pages: Chunk[] = [];

  await Promise.all(
    toScrape.map(async (r) => {
      try {
        const page = await cached(`page:${r.metadata.url}`, PAGE_TTL_MS, () =>
          webFetch(r.metadata.url, { timeoutMs: SCRAPE_TIMEOUT_MS }),
        );

        pages.push({
          content: page.markdown.slice(0, MAX_PAGE_CHARS),
          metadata: {
            title: page.title || r.metadata.title,
            url: page.url,
          },
        });
      } catch (err) {
        console.log("Error scraping", r.metadata.url, err);
      }
    }),
  );

  const scrapedUrls = new Set(pages.map((p) => p.metadata.url));

  return [
    ...pages,
    ...uniqueSnippets.filter((s) => !scrapedUrls.has(s.metadata.url)),
  ];
};
