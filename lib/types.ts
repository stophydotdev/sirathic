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

type ResearchSubStepData =
  | { type: "reasoning"; reasoning: string }
  | { type: "searching"; queries: string[] }
  | { type: "reading"; urls: string[] };

type ResearchSubStep = { id: string } & ResearchSubStepData;

type TextBlock = {
  id: string;
  type: "text";
  data: string;
};

type ResearchBlock = {
  id: string;
  type: "research";
  data: {
    subSteps: ResearchSubStep[];
  };
};

type SourceBlock = {
  id: string;
  type: "source";
  data: Chunk[];
};

type Block = TextBlock | ResearchBlock | SourceBlock;

export type {
  ChatTurnMessage,
  Chunk,
  ResearchSubStepData,
  ResearchSubStep,
  TextBlock,
  ResearchBlock,
  SourceBlock,
  Block,
  FirecrawlResponse,
  WebSearchResult,
  WebSearchOptions,
  WebSearchResponse,
  WebFetchResult,
  WebFetchOptions,
  WebScrapeResponse,
};
