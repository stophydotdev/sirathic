import { firecrawl } from "./firecrawl";
import type {
  WebFetchOptions,
  WebFetchResult,
  WebScrapeResponse,
} from "./types";

export const webFetch = async (
  url: string,
  options: WebFetchOptions = {},
): Promise<WebFetchResult> => {
  const res = await firecrawl<WebScrapeResponse>(
    "/v2/scrape",
    {
      url,
      formats: ["markdown"],
      onlyMainContent: options.onlyMainContent ?? true,
    },
    options.timeoutMs ?? 60_000,
  );

  return {
    url: res.data.metadata?.sourceURL ?? url,
    title: res.data.metadata?.title ?? "",
    markdown: res.data.markdown ?? "",
    statusCode: res.data.metadata?.statusCode,
  };
};
