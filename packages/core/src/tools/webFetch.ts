import { env } from "@sirathic/env/server";
import { z } from "zod";
import { cacheFor } from "../cache";
import { type WebFetchResult, webFetchResult } from "../web/types";
import { cleanUrl } from "../web/url";

const API = "https://api.stophy.dev/v1/web/scrape";
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

const scraped = z.object({
  data: z.object({
    markdown: z.string().optional(),
    metadata: z.object({
      title: z.string().nullable(),
      sourceURL: z.string(),
      statusCode: z.number(),
    }),
  }),
});

const failure = z.object({ error: z.object({ message: z.string() }) });

const pageCache = cacheFor({
  namespace: "page:v2",
  schema: webFetchResult,
  freshMs: 7 * 24 * 60 * 60_000,
  keepMs: 30 * 24 * 60 * 60_000,
});

const fetchLive = async (url: string): Promise<WebFetchResult> => {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.STOPHY_API_KEY && {
        authorization: `Bearer ${env.STOPHY_API_KEY}`,
      }),
    },
    body: JSON.stringify({
      url: readableUrl(url),
      formats: ["markdown"],
      onlyMainContent: true,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const reason =
      failure.safeParse(body).data?.error.message ??
      `Stophy answered ${response.status}`;
    throw new Error(`Fetching ${url} failed: ${reason}`);
  }
  const { markdown = "", metadata } = scraped.parse(body).data;
  if (markdown.trim().length < MIN_TEXT_CHARS) {
    throw new Error(`Fetching ${url} found no readable text`);
  }
  return {
    url: metadata.sourceURL,
    title: metadata.title ?? "",
    markdown: markdown.trim(),
    statusCode: metadata.statusCode,
  };
};

export const webFetchInput = z.object({ url: z.url() });

export const webFetch = ({ url }: z.infer<typeof webFetchInput>) => {
  const cleaned = cleanUrl(url);
  return pageCache(cleaned, () => fetchLive(cleaned));
};
