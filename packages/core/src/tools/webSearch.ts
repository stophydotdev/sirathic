import { env } from "@sirathic/env/server"
import { tool } from "ai"
import { z } from "zod"
import { cacheKey, cached, normalizeQuery } from "../cache"
import { filterToAllowlist } from "./sourceRegistry"
import type {
  ResearchSource,
  ResearchMode,
  SearchBatch,
  SearchCandidate,
  SearchHit,
  SearchOptions,
  SearchResponse,
  SearxngConfig,
  SourceRole,
  SourceTier,
  SourceTopic,
  UnresponsiveEngine,
} from "../types"

const DEFAULT_TIMEOUT_MS = 25_000
const RESULTS_PER_PAGE = 20
const EVERGREEN_SEARCH_TTL_SECONDS = 6 * 60 * 60
const CURRENT_SEARCH_TTL_SECONDS = 10 * 60
// Bump when the SearXNG engine pool or search semantics change so cached
// responses cannot report removed engines or preserve obsolete ranking inputs.
const SEARCH_CACHE_PROFILE = "residential-text-v2"

export function searchCacheTtl(query: string): number {
  return /\b(?:breaking|current|currently|latest|news|recent|recently|today|tonight|this (?:week|month|year)|202[4-9])\b/i.test(query)
    ? CURRENT_SEARCH_TTL_SECONDS
    : EVERGREEN_SEARCH_TTL_SECONDS
}

export async function searchSearxng(opts: SearchOptions, config: SearxngConfig): Promise<SearchResponse> {
  const requested = opts.limit && opts.limit > 0 ? opts.limit : RESULTS_PER_PAGE
  const key = cacheKey("search", {
    profile: SEARCH_CACHE_PROFILE,
    categories: config.categories ?? env.SEARXNG_CATEGORIES ?? "",
    locale: opts.locale ?? "en",
    query: normalizeQuery(opts.query),
    requested,
    searxngUrl: config.searxngUrl.replace(/\/$/, ""),
  })

  return cached(
    key,
    searchCacheTtl(opts.query),
    () => searchSearxngUncached(opts, config, requested),
    (response) => response.results.length > 0,
  )
}

async function searchSearxngUncached(
  opts: SearchOptions,
  config: SearxngConfig,
  requested: number,
): Promise<SearchResponse> {
  if (!config.searxngUrl) {
    throw new Error("searxng: searxngUrl is required (e.g. http://localhost:18888)")
  }

  const pageCount = Math.ceil(requested / RESULTS_PER_PAGE)

  const results: SearchHit[] = []
  const unresponsive = new Map<string, string>()

  for (let pageno = 1; pageno <= pageCount; pageno++) {
    const page = parseSearxngPage(await requestPage(opts, config, pageno))
    results.push(...page.results)
    for (const entry of page.unresponsiveEngines) {
      if (!unresponsive.has(entry.engine)) unresponsive.set(entry.engine, entry.reason)
    }
    if (page.results.length === 0) break
  }

  return {
    query: opts.query,
    retrievedAt: new Date().toISOString(),
    results: results.slice(0, requested),
    unresponsiveEngines: [...unresponsive].map(([engine, reason]) => ({ engine, reason })),
  }
}

async function requestPage(opts: SearchOptions, config: SearxngConfig, pageno: number): Promise<string> {
  const params = new URLSearchParams({
    q: opts.query,
    language: opts.locale ?? "en",
    categories: config.categories ?? env.SEARXNG_CATEGORIES ?? "",
    pageno: String(pageno),
    format: "json",
  })

  const url = `${config.searxngUrl.replace(/\/$/, "")}/search?${params.toString()}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": config.userAgent ?? "sirathic/websearch",
  }
  if (config.searxngApiKey) headers.Authorization = `Bearer ${config.searxngApiKey}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal, headers })
    const body = await res.text()
    if (!res.ok) throw new Error(`searxng ${res.status}: ${body.slice(0, 500)}`)
    return body
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`searxng timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function parseSearxngPage(text: string): { results: SearchHit[]; unresponsiveEngines: UnresponsiveEngine[] } {
  const payload = parseJson(text)
  const rawResults = Array.isArray(payload?.results) ? payload.results : []

  const results = rawResults
    .map((item, index): SearchHit | undefined => {
      if (!isRecord(item) || typeof item.url !== "string") return undefined
      return {
        url: item.url,
        title: stringValue(item.title) ?? "",
        snippet: stringValue(item.content) ?? "",
        score: typeof item.score === "number" ? item.score : 1 / (index + 1),
        engines: engineList(item),
        publishedDate: stringValue(item.publishedDate),
      } satisfies SearchHit
    })
    .filter((hit): hit is SearchHit => Boolean(hit))

  return { results, unresponsiveEngines: parseUnresponsive(payload?.unresponsive_engines) }
}

function engineList(item: Record<string, unknown>): string[] {
  if (Array.isArray(item.engines)) {
    return item.engines.filter((e): e is string => typeof e === "string")
  }
  const single = stringValue(item.engine)
  return single ? [single] : []
}

function parseUnresponsive(value: unknown): UnresponsiveEngine[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry): UnresponsiveEngine | undefined => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") return undefined
      return { engine: entry[0], reason: typeof entry[1] === "string" ? entry[1] : "" }
    })
    .filter((entry): entry is UnresponsiveEngine => Boolean(entry))
}

function parseJson(text: string): Record<string, unknown> | undefined {
  try {
    const data = JSON.parse(text) as unknown
    return isRecord(data) ? data : undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    url.hash = ""
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") url.searchParams.delete(key)
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "")
    return url.toString()
  } catch {
    return undefined
  }
}

function sourceKind(domain: string): ResearchSource {
  if (domain === "quran.com" || domain.endsWith(".quran.com")) return "quran"
  if (domain === "sunnah.com" || domain.endsWith(".sunnah.com") || domain === "muwatta.com") return "hadith"
  return "web"
}

function isDirectSourcePage(url: URL): boolean {
  const domain = url.hostname.replace(/^www\./, "")
  if (domain === "sunnah.com") {
    const individualHadith = /^\/[^/]+:\d+[a-z]?$|^\/[^/]+\/\d+\/\d+[a-z]?$/i.test(url.pathname)
    if (!individualHadith) return false
  }
  if (domain === "quran.com" && !/^\/(?:\d+|[a-z][a-z'-]*)(?::|\/)\d+(?:\/|$)/i.test(url.pathname)) return false
  if (url.pathname === "/" || url.pathname.startsWith("/tags/") || url.pathname.startsWith("/tag/")) return false
  return true
}

function pageQualityScore(url: URL, kind: ResearchSource): number {
  const domain = url.hostname.replace(/^www\./, "")
  if (kind === "quran" && domain === "quran.com") {
    if (url.pathname.includes("/reflections")) return -15
    if (url.pathname.includes("/tafsirs/")) return -8
    return 10
  }
  if (kind === "hadith") return 5
  return 0
}

const QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "biography", "do", "evidence", "for", "hadith", "how", "i", "in", "is", "islam", "islamic", "me", "muslim", "my", "of", "or", "quran", "ruling", "scholarly", "the", "to", "what", "who", "why",
])

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/site:\S+/g, " ")
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((term) => term.length > 1 && !QUERY_STOP_WORDS.has(term)) ?? []
}

function userIntentText(query: string): string {
  return query
    .replace(/site:\S+/gi, " ")
    .replace(
      /^(?:Quran evidence|Hadith evidence|Islamic biography|Hanafi ruling|Shafii ruling|Maliki ruling|Shia ruling|Islamic counseling guidance|practical Islamic guidance|scholarly ruling|آية من القرآن|حديث|سيرة إسلامية|فتوى)\s+/iu,
      "",
    )
    .trim()
}

function normalizedSearchText(value: string): string {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? ""
}

function relevanceScore(hit: SearchHit, query: string): number {
  const terms = [...new Set(queryTerms(query))]
  if (terms.length === 0) return 0

  const title = hit.title.toLowerCase()
  const snippet = hit.snippet.toLowerCase()
  const titleMatches = terms.filter((term) => title.includes(term)).length
  const snippetMatches = terms.filter((term) => snippet.includes(term)).length
  const coverage = titleMatches / terms.length
  const intent = normalizedSearchText(userIntentText(query))
  const normalizedTitle = normalizedSearchText(hit.title)
  const exactIntentTitle = intent.length >= 3 && (normalizedTitle === intent || normalizedTitle.startsWith(`${intent} `)) ? 60 : 0

  return titleMatches * 12 + snippetMatches * 3 + (coverage === 1 ? 15 : 0) + exactIntentTitle
}

function authorityScore(tier: SourceTier, kind: ResearchSource): number {
  if (tier !== "A") return 75
  if (kind === "quran") return 120
  if (kind === "hadith") return 110
  return 100
}

const ROLE_KEYWORDS: Record<Exclude<SourceRole, "primary" | "discovery">, string[]> = {
  fatwa: ["allowed", "forbidden", "halal", "haram", "obligatory", "permissible", "ruling"],
  guidance: ["better", "become", "career", "daily", "focus", "goal", "habit", "improve", "plan", "productivity", "routine", "work"],
  counseling: ["abuse", "anxiety", "conflict", "counsel", "depressed", "family", "feel", "lonely", "lost", "marriage", "mental", "overwhelmed", "relationship", "stress"],
}

const TOPIC_KEYWORDS: Record<SourceTopic, string[]> = {
  "daily-life": ["daily", "day", "life", "routine"],
  family: ["child", "family", "parent"],
  finance: ["business", "finance", "income", "money"],
  habits: ["habit", "routine"],
  "mental-health": ["anxiety", "depressed", "mental", "stress"],
  productivity: ["focus", "goal", "plan", "productive", "productivity"],
  relationships: ["friend", "marriage", "relationship", "spouse"],
  spirituality: ["faith", "iman", "spiritual"],
  work: ["career", "job", "work"],
  worship: ["fast", "prayer", "salah", "worship"],
}

function intentScore(role: SourceRole, topics: SourceTopic[], query: string): number {
  const terms = new Set(queryTerms(query))
  const roleMatches = role === "primary" || role === "discovery"
    ? 0
    : ROLE_KEYWORDS[role].filter((keyword) => terms.has(keyword)).length
  const topicMatches = topics.reduce(
    (count, topic) => count + TOPIC_KEYWORDS[topic].filter((keyword) => terms.has(keyword)).length,
    0,
  )
  return Math.min(roleMatches * 20, 50) + Math.min(topicMatches * 6, 24)
}

type ExpertLane = {
  prefix: string
  primaryDomain: string
  secondaryDomain: string
}

function isBiographyQuestion(question: string): boolean {
  const normalized = question.toLowerCase()
  return (
    /\b(?:biograph(?:y|ical)|life of)\b/u.test(normalized) ||
    /\bwho (?:is|was) (?!a\b|an\b|the\b|allah\b|god\b)[\p{L}]/u.test(normalized) ||
    /(?:سيرة|حياة)\s/u.test(normalized) ||
    /من هو (?!الله\b)[\p{Script=Arabic}]/u.test(normalized)
  )
}

// Keep one site per query. Production engines returned no results for combined
// `site:a OR site:b` filters even when each single-domain query worked.
function expertLane(question: string): ExpertLane {
  const normalized = question.toLowerCase()

  if (isBiographyQuestion(normalized)) {
    return { prefix: "Islamic biography", primaryDomain: "islamqa.info", secondaryDomain: "yaqeeninstitute.org" }
  }
  if (/\bhanafi\b|حنفي/u.test(normalized)) {
    return { prefix: "Hanafi ruling", primaryDomain: "islamqa.org", secondaryDomain: "askimam.org" }
  }
  if (/\bshafi(?:i|['’]i)\b|شافعي/u.test(normalized)) {
    return { prefix: "Shafii ruling", primaryDomain: "islamqa.org", secondaryDomain: "muftiwp.gov.my" }
  }
  if (/\bmaliki\b|مالكي/u.test(normalized)) {
    return { prefix: "Maliki ruling", primaryDomain: "islamqa.org", secondaryDomain: "malikifiqhqa.com" }
  }
  if (/\bshia\b|\bshi['’]?a\b|شيعي/u.test(normalized)) {
    return { prefix: "Shia ruling", primaryDomain: "sistani.org", secondaryDomain: "al-islam.org" }
  }
  if (/\p{Script=Arabic}/u.test(normalized)) {
    return { prefix: "scholarly ruling", primaryDomain: "islamqa.info", secondaryDomain: "islamweb.net" }
  }
  if (/abuse|anxiety|conflict|counsel|depress|lonely|mental health|overwhelm|stress|قلق|اكتئاب|وسواس|إساءة/u.test(normalized)) {
    return { prefix: "Islamic counseling guidance", primaryDomain: "aboutislam.net", secondaryDomain: "yaqeeninstitute.org" }
  }
  if (/career|daily routine|focus|goal|habit|plan their day|productiv|work-life|روتين|عمل/u.test(normalized)) {
    return { prefix: "practical Islamic guidance", primaryDomain: "productivemuslim.com", secondaryDomain: "seekersguidance.org" }
  }
  if (/business|debt|finance|income|interest|money|mortgage|riba|zakat|دين|ربا|زكاة/u.test(normalized)) {
    return { prefix: "scholarly ruling", primaryDomain: "islamqa.info", secondaryDomain: "dar-alifta.org" }
  }
  return { prefix: "scholarly ruling", primaryDomain: "islamqa.info", secondaryDomain: "islamweb.net" }
}

function normalizedQuestion(question: string): string {
  const normalized = question.trim().replace(/\s+/g, " ")
  if (!normalized) throw new Error("search query is required")
  return normalized
}

function primaryEvidenceQueries(question: string): [string, string] {
  const arabic = /\p{Script=Arabic}/u.test(question)
  return arabic
    ? [`آية من القرآن ${question} site:quran.com`, `حديث ${question} site:sunnah.com`]
    : [`Quran evidence ${question} site:quran.com`, `Hadith evidence ${question} site:sunnah.com`]
}

function expertQuery(question: string, lane: ExpertLane, domain: string): string {
  const prefix = /\p{Script=Arabic}/u.test(question)
    ? lane.prefix === "Islamic biography" ? "سيرة إسلامية" : "فتوى"
    : lane.prefix
  return `${prefix} ${question} site:${domain}`
}

export function planResearchQueries(question: string, mode: ResearchMode): string[] {
  const subject = normalizedQuestion(question)
  const [quranQuery, hadithQuery] = primaryEvidenceQueries(subject)
  const lane = expertLane(subject)
  const primaryExpertQuery = expertQuery(subject, lane, lane.primaryDomain)
  if (mode !== "quality") {
    if (isBiographyQuestion(subject)) return [subject, quranQuery, primaryExpertQuery]
    return [quranQuery, hadithQuery, primaryExpertQuery]
  }
  return [subject, quranQuery, hadithQuery, primaryExpertQuery, expertQuery(subject, lane, lane.secondaryDomain)]
}

export function buildPrioritySearchQueries(query: string): string[] {
  return planResearchQueries(query, "quality")
}

export function routeSearchQueries(queries: string[], question = queries[0] ?? ""): string[] {
  const planned = planResearchQueries(question, queries.length > 3 ? "quality" : "balanced")
  return planned.slice(0, queries.length)
}

export function rankSearchCandidates(
  batches: SearchBatch[],
  enabledSources: ResearchSource[] = ["quran", "hadith", "web"],
): SearchCandidate[] {
  const enabled = new Set(enabledSources)
  const candidates = new Map<string, SearchCandidate & { queries: Set<string> }>()

  for (const batch of batches) {
    const { citable } = filterToAllowlist(batch.results)
    for (const hit of citable) {
      const url = canonicalUrl(hit.url)
      if (!url) continue
      const parsed = new URL(url)
      if (!isDirectSourcePage(parsed)) continue
      const domain = parsed.hostname.replace(/^www\./, "")
      const kind = sourceKind(domain)
      if (!enabled.has(kind)) continue

      const existing = candidates.get(url)
      if (existing) {
        const relevance = relevanceScore(hit, batch.query) + intentScore(hit.source.role, hit.source.topics ?? [], batch.query)
        existing.queries.add(batch.query)
        existing.matchedQueries = existing.queries.size
        existing.score +=
          Math.min(Math.max(hit.score, 0), 10) +
          relevance
        existing.relevance += relevance
        if (hit.snippet.length > existing.snippet.length) existing.snippet = hit.snippet
        continue
      }

      const queries = new Set([batch.query])
      const relevance = relevanceScore(hit, batch.query) + intentScore(hit.source.role, hit.source.topics ?? [], batch.query)
      candidates.set(url, {
        url,
        title: hit.title,
        snippet: hit.snippet.slice(0, 600),
        domain,
        faviconUrl: `${parsed.origin}/favicon.ico`,
        tier: hit.source.tier,
        role: hit.source.role,
        topics: hit.source.topics ?? [],
        source: hit.source.name,
        kind,
        matchedQueries: 1,
        relevance,
        score:
          authorityScore(hit.source.tier, kind) +
          (hit.source.priority ?? 0) +
          pageQualityScore(parsed, kind) +
          Math.min(Math.max(hit.score, 0), 10) +
          relevance,
        queries,
      })
    }
  }

  const ranked = [...candidates.values()]
    .map(({ queries: _queries, ...candidate }) => ({
      ...candidate,
      score: candidate.score + (candidate.matchedQueries - 1) * 20,
    }))
    .sort((a, b) => b.score - a.score || b.matchedQueries - a.matchedQueries)

  const relevant = ranked.filter((candidate) => candidate.relevance >= 12)
  if (relevant.length > 0) {
    const firstByDomain = new Map<string, SearchCandidate>()
    for (const candidate of relevant) {
      if (!firstByDomain.has(candidate.domain)) firstByDomain.set(candidate.domain, candidate)
    }
    const diverse = relevant.filter((candidate) => firstByDomain.get(candidate.domain) === candidate)
    const selected = new Set(diverse.map((candidate) => candidate.url))
    const remainingRelevant = relevant.filter((candidate) => !selected.has(candidate.url))
    const relevantUrls = new Set(relevant.map((candidate) => candidate.url))
    return [...diverse, ...remainingRelevant, ...ranked.filter((candidate) => !relevantUrls.has(candidate.url))]
  }

  const firstByKind = new Map<ResearchSource, SearchCandidate>()
  for (const candidate of ranked) if (!firstByKind.has(candidate.kind)) firstByKind.set(candidate.kind, candidate)
  const diverse = ranked.filter((candidate) => firstByKind.get(candidate.kind) === candidate)
  const selected = new Set(diverse.map((candidate) => candidate.url))
  return [...diverse, ...ranked.filter((candidate) => !selected.has(candidate.url))]
}

export async function searchPrioritySources(
  query: string,
  enabledSources: ResearchSource[] = ["quran", "hadith", "web"],
): Promise<{ queries: string[]; batches: SearchBatch[]; candidates: SearchCandidate[] }> {
  const queries = buildPrioritySearchQueries(query)
  const batches = await Promise.all(
    queries.map(async (searchQuery) => {
      const response = await searchSearxng({ query: searchQuery, limit: 12 }, { searxngUrl: env.SEARXNG_URL })
      return { query: searchQuery, results: response.results }
    }),
  )

  return { queries, batches, candidates: rankSearchCandidates(batches, enabledSources).slice(0, 12) }
}

export function createSearchSourcesTool(options: {
  question?: string
  queryCount: number
  sources?: ResearchSource[]
  onCandidates?: (candidates: SearchCandidate[]) => void
  onSearchResults?: (research: { generatedQueries: string[]; queries: string[]; sources: SearchCandidate[] }) => void
}) {
  const queryCount = Math.min(5, Math.max(3, options.queryCount))
  const strategy =
    queryCount === 3
      ? "Slot 1: broad user intent. Slot 2: combined Qur'an/hadith primary evidence. Slot 3: the appropriate expert lane—formal fatwa, practical guidance, or counseling."
      : "Slot 1: broad user intent. Slot 2: Qur'an evidence. Slot 3: hadith evidence. Slot 4: the appropriate expert lane—formal fatwa, practical guidance, or counseling. Slot 5: Arabic terminology, madhhab disagreement, community wording, or another missing viewpoint."
  return tool({
    description: `Generate exactly ${queryCount} genuinely distinct search intents for the user's question and run them in parallel across the broad web. ${strategy} For question-and-answer research, prefer individual answers from IslamQA.info, IslamWeb Fatwas, SeekersGuidance Answers, IslamQA.org, and official iftaa archives. Preserve the subject in every query; avoid cosmetic rewordings. Returns deduplicated candidates after relevance, page-quality, authority, and trust ranking; these are leads until fetchSources reads them.`,
    inputSchema: z.object({
      queries: z.array(z.string().min(3)).length(queryCount).describe(`Exactly ${queryCount} distinct search queries`),
    }),
    execute: async ({ queries }) => {
      const routedQueries = routeSearchQueries(queries, options.question)
      let batches = await Promise.all(
        routedQueries.map(async (query) => {
          const response = await searchSearxng({ query, limit: 12 }, { searxngUrl: env.SEARXNG_URL })
          return { query, results: response.results }
        }),
      )
      let candidates = rankSearchCandidates(batches, options.sources).slice(0, 12)
      if (candidates.length === 0 && options.question) {
        const attempted = new Set(routedQueries)
        const fallbackQueries = buildPrioritySearchQueries(options.question).filter((query) => !attempted.has(query))
        const fallbackBatches = await Promise.all(
          fallbackQueries.map(async (query) => {
            const response = await searchSearxng({ query, limit: 12 }, { searxngUrl: env.SEARXNG_URL })
            return { query, results: response.results }
          }),
        )
        batches = [...batches, ...fallbackBatches]
        candidates = rankSearchCandidates(batches, options.sources).slice(0, 12)
      }
      options.onCandidates?.(candidates)
      options.onSearchResults?.({ generatedQueries: queries, queries: batches.map((batch) => batch.query), sources: candidates })
      return candidates
    },
  })
}
