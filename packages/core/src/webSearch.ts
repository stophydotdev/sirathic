import { firecrawl } from "./firecrawl";
import { WebSearchOptions, WebSearchResponse, WebSearchResult } from "./types";

export const webSearch = async (
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResult[]> => {
  const res = await firecrawl<WebSearchResponse>(
    "/v2/search",
    {
      query,
      limit: options.limit ?? 10,
      sources: ["web"],
      ...(options.location && { location: options.location }),
      ...(options.tbs && { tbs: options.tbs }),
    },
    30_000,
  );

  return res.data.web ?? [];
};
