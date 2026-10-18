import { z } from "zod";
import { cacheFor } from "../cache";
import { stophy } from "../stophy";
import { type WebFetchResult, webFetchResult } from "../web/types";
import { cleanUrl } from "../web/url";

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
  const markdown = data.markdown?.trim() ?? "";
  if (markdown.length < MIN_TEXT_CHARS) {
    throw new Error(`Fetching ${url} found no readable text`);
  }
  return {
    url: data.metadata.sourceURL ?? url,
    title: data.metadata.title ?? "",
    markdown,
    statusCode: data.metadata.statusCode,
  };
};

export const webFetchInput = z.object({ url: z.url() });

export const webFetch = ({ url }: z.infer<typeof webFetchInput>) => {
  const cleaned = cleanUrl(url);
  return pageCache(cleaned, () => fetchLive(cleaned));
};
