import type { AIProvider } from "@sirathic/llm"

export type { AIProvider }

export type ResearchSource = "quran" | "hadith" | "web"

export interface BuildToolsOptions {
  question?: string
  sources?: ResearchSource[]
  queryCount?: number
  initialFetches?: number
  extraFetches?: number
  onSearchResults?: (research: ResearchTrace) => void
}

export interface Source {
  index: number
  kind: "hadith" | "quran" | "web"
  label: string
  url: string
  lang?: string
  grade?: string | null
  tier?: string
  role?: SourceRole
  domain: string
  faviconUrl: string
  text: string
}

export type RawSource = Omit<Source, "index">

export interface WebHit {
  url: string
  title?: string | null
  tier?: string
  role?: SourceRole
  source: string
  kind?: Source["kind"]
  faviconUrl?: string
  text: string
}

export type ResearchMode = "speed" | "balanced" | "quality"

export interface ResearchPolicy {
  maxSteps: number
  queryCount: number
  initialFetches: number
  extraFetches: number
}

export interface AskOptions {
  provider?: AIProvider
  model?: string
  mode?: ResearchMode
  sources?: ResearchSource[]
}

export interface AskResult {
  answer: string
  sources: Source[]
  research: ResearchTrace
}

export interface ResearchTrace {
  generatedQueries: string[]
  queries: string[]
  sources: SearchCandidate[]
}

export interface GatherResult {
  sources: Source[]
  research: ResearchTrace
}

export type AskEvent =
  | { type: "research-start"; mode: ResearchMode }
  | ({ type: "search-results" } & ResearchTrace)
  | { type: "tool-complete"; tools: string[]; found: number }
  | { type: "sources"; sources: Source[] }
  | { type: "answer-delta"; delta: string }
  | { type: "answer-replace"; answer: string; reason: "citation-validation" }
  | ({ type: "done" } & AskResult)
  | { type: "error"; message: string }

export type AskEventEmitter = (event: AskEvent) => void | Promise<void>

export interface CitationValidation {
  valid: boolean
  invalidIndexes: number[]
  uncitedPassages: string[]
}

export type SourceTier = "A" | "B" | "C"
export type Madhhab = "hanafi" | "shafii" | "maliki" | "hanbali" | "shia" | "cross"
export type SourceRole = "primary" | "fatwa" | "guidance" | "counseling" | "discovery"
export type SourceTopic =
  | "daily-life"
  | "family"
  | "finance"
  | "habits"
  | "mental-health"
  | "productivity"
  | "relationships"
  | "spirituality"
  | "work"
  | "worship"

export interface SourceDomain {
  domain: string
  tier: SourceTier
  name: string
  madhhab: Madhhab
  role: SourceRole
  citable: boolean
  allowedPaths?: string[]
  allowedPathPatterns?: string[]
  excludedPaths?: string[]
  topics?: SourceTopic[]
  priority?: number
  immutable?: boolean
}

export type Classified<T> = T & { source: SourceDomain }

export interface AllowlistResult<T> {
  citable: Classified<T>[]
  leads: Classified<T>[]
  rejected: T[]
}

export interface SearchOptions {
  query: string
  limit?: number
  timeoutMs?: number
  locale?: string
}

export interface SearchHit {
  url: string
  title: string
  snippet: string
  score: number
  engines: string[]
  publishedDate?: string
}

export interface UnresponsiveEngine {
  engine: string
  reason: string
}

export interface SearchResponse {
  query: string
  retrievedAt: string
  results: SearchHit[]
  unresponsiveEngines: UnresponsiveEngine[]
}

export interface SearchBatch {
  query: string
  results: SearchHit[]
}

export interface SearchCandidate {
  url: string
  title: string
  snippet: string
  domain: string
  faviconUrl: string
  tier: SourceTier
  role: SourceRole
  topics: SourceTopic[]
  source: string
  kind: Source["kind"]
  matchedQueries: number
  relevance: number
  score: number
}

export interface SearxngConfig {
  searxngUrl: string
  searxngApiKey?: string
  userAgent?: string
  categories?: string
}

export type CrawlMode = "auto" | "static" | "browser"
export type EngineMode = Exclude<CrawlMode, "auto">
export type MarkdownVariant = "fit" | "raw" | "citations"
export type FetchFailureReason = "invalid-url" | "too-large" | "http-error" | "timeout" | "no-markdown" | "transport"

export interface FetchOptions {
  url: string
  crawl4aiUrl?: string
  crawlMode?: CrawlMode
  markdownVariant?: MarkdownVariant
  timeoutMs?: number
  maxBytes?: number
  userAgent?: string
  browserConfig?: Record<string, unknown>
  crawlerConfig?: Record<string, unknown>
}

export interface FetchSuccess {
  ok: true
  url: string
  finalUrl: string
  status: number | null
  title: string
  lang: string | null
  markdown: string
  metadata: Record<string, unknown>
  links: Record<string, unknown> | null
  media: Record<string, unknown> | null
  contentHash: string
  byteSize: number
  truncated: boolean
  fetchedAt: string
  via: "direct" | "crawl4ai"
  crawlMode: "direct" | EngineMode
}

export interface FetchFailure {
  ok: false
  url: string
  reason: FetchFailureReason
  status?: number
  message?: string
}

export type FetchResult = FetchSuccess | FetchFailure

export interface Crawl4AIResult {
  success?: boolean
  url?: unknown
  final_url?: unknown
  redirected_url?: unknown
  status_code?: unknown
  status?: unknown
  error_message?: unknown
  markdown?: unknown
  metadata?: unknown
  links?: unknown
  media?: unknown
}
