import { z } from "zod";
import { cacheFor } from "../cache";
import { scrapedPage, stophy } from "../stophy";
import { type WebFetchResult, webFetchResult } from "../web/types";
import { cleanUrl, publicUrl } from "../web/url";

const TIMEOUT_MS = 30_000;
const MIN_TEXT_CHARS = 50;

const READABLE_COPIES = [
  [
    /^https:\/\/(?:www\.)?binothaimeen\.net\/content\/(\d+)/u,
    "https://old.binothaimeen.net/content/$1",
  ],
] as const;

const readableUrl = (url: string) =>
  READABLE_COPIES.reduce<string>(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    url,
  );

const pageCache = cacheFor({
  namespace: "page:v2",
  schema: webFetchResult,
  freshMs: 7 * 24 * 60 * 60_000,
  keepMs: 30 * 24 * 60 * 60_000,
});

const fetchLive = async (url: string): Promise<WebFetchResult> => {
  const { data } = await stophy.web
    .scrape(
      { url: readableUrl(url), formats: ["markdown"], onlyMainContent: true },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    .catch((err: Error) => {
      throw new Error(`Fetching ${url} failed: ${err.message}`);
    });
  const page = scrapedPage.parse(data);
  const markdown = page.markdown?.trim() ?? "";
  if (markdown.length < MIN_TEXT_CHARS) {
    throw new Error(`Fetching ${url} found no readable text`);
  }
  return {
    url: page.metadata.sourceURL ?? url,
    title: page.metadata.title ?? "",
    markdown,
    statusCode: page.metadata.statusCode,
  };
};

export const webFetchInput = z.object({ url: publicUrl });

export const webFetch = (input: z.input<typeof webFetchInput>) => {
  const cleaned = cleanUrl(webFetchInput.parse(input).url);
  return pageCache(cleaned, () => fetchLive(cleaned));
};
