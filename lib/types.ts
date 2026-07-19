type ChatTurnMessage = {
  role: "user" | "assistant";
  content: string;
};

type Chunk = {
  content: string;
  metadata: {
    title: string;
    url: string;
  };
};

type FirecrawlResponse = {
  success: boolean;
  error?: string;
};

type WebSearchResult = {
  url: string;
  title: string;
  description: string;
};

type WebSearchOptions = {
  limit?: number;
  location?: string;
  tbs?: string;
};

type WebSearchResponse = {
  data: {
    web?: WebSearchResult[];
  };
  warning?: string;
};

type WebFetchResult = {
  url: string;
  title: string;
  markdown: string;
  statusCode?: number;
};

type WebFetchOptions = {
  onlyMainContent?: boolean;
  timeoutMs?: number;
};

type WebScrapeResponse = {
  data: {
    markdown?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
};

export type {
  ChatTurnMessage,
  Chunk,
  FirecrawlResponse,
  WebSearchResult,
  WebSearchOptions,
  WebSearchResponse,
  WebFetchResult,
  WebFetchOptions,
  WebScrapeResponse,
};
