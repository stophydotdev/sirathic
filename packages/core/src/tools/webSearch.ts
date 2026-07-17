import { env } from "@sirathic/env/server"
import { tool } from "ai"
import { z } from "zod"
import { cacheKey, cached, normalizeQuery } from "../cache"
import { classifyDomain, filterToAllowlist } from "./sourceRegistry"
import type {
  ResearchSource,
  ResearchMode,
  FirecrawlConfig,
  SearchBatch,
  SearchCandidate,
  SearchHit,
  SearchOptions,
  SearchResponse,
  SourceRole,
  SourceTier,
  SourceTopic,
  UnresponsiveEngine,
} from "../types"

const DEFAULT_TIMEOUT_MS = 25_000
export const MAX_DISCOVERY_RESULTS = 30
const RESULTS_PER_PAGE = MAX_DISCOVERY_RESULTS
export const SEARCH_RESULTS_PER_QUERY = 15
const EVERGREEN_SEARCH_TTL_SECONDS = 6 * 60 * 60
const CURRENT_SEARCH_TTL_SECONDS = 10 * 60
// Bump when Firecrawl search semantics change so cached responses cannot
// preserve obsolete ranking inputs.
const SEARCH_CACHE_PROFILE = "firecrawl-v3"

export function searchCacheTtl(query: string): number {
  return /\b(?:breaking|current|currently|latest|news|recent|recently|today|tonight|this (?:week|month|year)|202[4-9])\b/i.test(query)
    ? CURRENT_SEARCH_TTL_SECONDS
    : EVERGREEN_SEARCH_TTL_SECONDS
}

export async function searchFirecrawl(opts: SearchOptions, config: FirecrawlConfig): Promise<SearchResponse> {
  const requested = opts.limit && opts.limit > 0 ? opts.limit : RESULTS_PER_PAGE
  const key = cacheKey("search", {
    profile: SEARCH_CACHE_PROFILE,
    locale: opts.locale ?? "en",
    query: normalizeQuery(opts.query),
    includeDomains: opts.includeDomains?.map((domain) => domain.toLowerCase()).sort() ?? [],
    requested,
    firecrawlUrl: config.firecrawlUrl.replace(/\/$/, ""),
  })

  return cached(
    key,
    searchCacheTtl(opts.query),
    () => searchFirecrawlUncached(opts, config, requested),
    (response) => response.results.length > 0,
  )
}

async function searchFirecrawlUncached(
  opts: SearchOptions,
  config: FirecrawlConfig,
  requested: number,
): Promise<SearchResponse> {
  if (!config.firecrawlUrl) throw new Error("firecrawl: firecrawlUrl is required")

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": config.userAgent ?? "sirathic/firecrawl-search",
  }
  if (config.firecrawlApiKey) headers.Authorization = `Bearer ${config.firecrawlApiKey}`

  let response: Response
  try {
    response = await fetch(`${config.firecrawlUrl.replace(/\/$/, "")}/v2/search`, {
      method: "POST",
      headers,
      body: JSON.stringify(firecrawlSearchRequestBody(opts, requested, timeoutMs)),
      signal: AbortSignal.timeout(timeoutMs + 1_000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed"
    if (/timeout|aborted/i.test(message)) throw new Error(`firecrawl timed out after ${timeoutMs}ms`)
    throw new Error(`firecrawl search failed: ${message}`)
  }

  const text = await response.text()
  if (!response.ok) throw new Error(`firecrawl ${response.status}: ${firecrawlError(text, response.statusText)}`)
  const parsed = parseFirecrawlSearchResponse(text)

  return {
    query: opts.query,
    retrievedAt: new Date().toISOString(),
    results: parsed.results.slice(0, requested),
    unresponsiveEngines: parsed.unresponsiveEngines,
  }
}

export function firecrawlSearchRequestBody(opts: SearchOptions, requested: number, timeoutMs: number) {
  return {
    query: opts.query,
    limit: Math.min(requested, 100),
    sources: ["web"],
    timeout: timeoutMs,
    ignoreInvalidURLs: true,
    ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
  }
}

export function parseFirecrawlSearchResponse(text: string): { results: SearchHit[]; unresponsiveEngines: UnresponsiveEngine[] } {
  const payload = parseJson(text)
  if (!payload || payload.success !== true) {
    throw new Error(`firecrawl search returned an unsuccessful response: ${firecrawlError(text, "invalid response")}`)
  }
  const data = payload.data
  const rawResults = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.web)
      ? data.web
      : []

  const results = rawResults
    .map((item, index): SearchHit | undefined => {
      if (!isRecord(item) || typeof item.url !== "string") return undefined
      return {
        url: item.url,
        title: stringValue(item.title) ?? "",
        snippet: stringValue(item.description) ?? stringValue(item.markdown) ?? "",
        score: 1 / (index + 1),
        engines: ["firecrawl"],
        publishedDate: firecrawlPublishedDate(item),
      } satisfies SearchHit
    })
    .filter((hit): hit is SearchHit => Boolean(hit))

  const warning = stringValue(payload.warning)
  return { results, unresponsiveEngines: warning ? [{ engine: "firecrawl", reason: warning }] : [] }
}

function firecrawlPublishedDate(item: Record<string, unknown>): string | undefined {
  const metadata = isRecord(item.metadata) ? item.metadata : undefined
  return stringValue(item.publishedDate) ?? stringValue(metadata?.publishedTime) ?? stringValue(metadata?.publishedDate)
}

function firecrawlError(text: string, fallback: string): string {
  const payload = parseJson(text)
  return stringValue(payload?.error) ?? fallback
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
  if (domain === "quran.com") {
    if (!/^\/(?:\d+|[a-z][a-z'-]*)(?::|\/)\d+\/?$/i.test(url.pathname)) return false
    const firstPart = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase()
    if (firstPart && ["ayah", "hizb", "juz", "manzil", "page", "rub"].includes(firstPart)) return false
  }
  if (domain.endsWith(".quran.com")) return false
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
  "a", "an", "and", "are", "as", "biography", "do", "evidence", "for", "hadith", "how", "i", "in", "is", "islam", "islamic", "me", "muslim", "my", "of", "or", "quran", "ruling", "scholarly", "should", "the", "to", "what", "who", "why",
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
  if (/(?:best way|how) to (?:offer |perform )?(?:pray|prayer)|(?:pray|prayer) (?:correctly|step by step)|كيفية الصلاة/u.test(normalized)) {
    return { prefix: "Description of the Prophets Prayer", primaryDomain: "islamqa.info", secondaryDomain: "seekersguidance.org" }
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
  if (/aqeedah|belief|faith|good life|meaning of life|purpose of life|spiritual|عقيدة|إيمان|معنى الحياة|الهدف من الحياة/u.test(normalized)) {
    return { prefix: "Islamic explanation", primaryDomain: "yaqeeninstitute.org", secondaryDomain: "seekersguidance.org" }
  }
  if (/become (?:a )?(?:better|good|great|strong) muslim|better muslim|good muslim|great muslim|improve (?:my |your )?(?:faith|iman)/u.test(normalized)) {
    return { prefix: "Islamic practical guidance", primaryDomain: "islamqa.info", secondaryDomain: "seekersguidance.org" }
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

function compactKeywords(question: string): string {
  const terms = question
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((term) => term.length > 1 && !["a", "an", "and", "are", "do", "does", "how", "i", "is", "me", "my", "of", "or", "should", "the", "to", "what", "who", "why"].includes(term)) ?? []
  return [...new Set(terms)].slice(0, 8).join(" ") || question
}

export function planResearchQueries(question: string, mode: ResearchMode): string[] {
  const subject = normalizedQuestion(question)
  if (mode === "speed") return [subject]

  const keywords = compactKeywords(subject)
  return [subject, `${keywords} Quran Sunnah`, `${keywords} Islamic guidance`]
}

export function buildPrioritySearchQueries(query: string): string[] {
  return planResearchQueries(query, "quality")
}

export function buildFocusedSearchRequests(question: string): SearchOptions[] {
  const subject = normalizedQuestion(question)
  const keywords = compactKeywords(subject)
  const lane = expertLane(subject)
  const selfImprovement = /become (?:a )?(?:better|good|great|strong) muslim|better muslim|good muslim|great muslim|improve (?:my |your )?(?:faith|iman)/iu.test(subject)
  if (selfImprovement) {
    return [
      { query: "qualities righteous believers faith good deeds character", includeDomains: ["quran.com"] },
      { query: "best Muslims good character faith deeds", includeDomains: ["sunnah.com"] },
      { query: "how to become a better Muslim practical steps", includeDomains: [lane.primaryDomain] },
    ]
  }
  return [
    { query: `${keywords} Quran guidance verses`, includeDomains: ["quran.com"] },
    { query: `${keywords} authentic hadith character`, includeDomains: ["sunnah.com"] },
    { query: `${keywords} ${lane.prefix}`, includeDomains: [lane.primaryDomain] },
  ]
}

export function routeSearchQueries(queries: string[], _question = queries[0] ?? ""): string[] {
  return [...new Set(queries.map((query) => query.trim().replace(/\s+/g, " ")).filter((query) => query.length >= 3))].slice(0, 3)
}

function candidateIdentity(title: string, url: string, kind: ResearchSource): string {
  if (kind !== "quran") return url
  const ayah = title.match(/\bsurah\s+(.+?)\s+ayah\s+(\d+)\b/i)
  return ayah ? `quran:${normalizedSearchText(ayah[1] ?? "")}:${ayah[2]}` : url
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
      let url = canonicalUrl(hit.url)
      if (!url) continue
      let parsed = new URL(url)
      if (!isDirectSourcePage(parsed)) continue
      const domain = parsed.hostname.replace(/^www\./, "")
      const kind = sourceKind(domain)
      if (!enabled.has(kind)) continue
      if (kind === "quran" || kind === "hadith") {
        parsed.search = ""
        url = parsed.toString()
        parsed = new URL(url)
      }
      const identity = candidateIdentity(hit.title, url, kind)

      const existing = candidates.get(identity)
      if (existing) {
        const relevance = relevanceScore(hit, batch.query) + intentScore(hit.source.role, hit.source.topics ?? [], batch.query)
        existing.queries.add(batch.query)
        existing.matchedQueries = existing.queries.size
        existing.score +=
          Math.min(Math.max(hit.score, 0), 10) +
          relevance
        existing.relevance += relevance
        if (hit.snippet.length > existing.snippet.length) existing.snippet = hit.snippet
        if (!existing.publishedDate && hit.publishedDate) existing.publishedDate = hit.publishedDate
        continue
      }

      const queries = new Set([batch.query])
      const relevance = relevanceScore(hit, batch.query) + intentScore(hit.source.role, hit.source.topics ?? [], batch.query)
      candidates.set(identity, {
        url,
        title: hit.title,
        snippet: hit.snippet.slice(0, 600),
        ...(hit.publishedDate ? { publishedDate: hit.publishedDate } : {}),
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

  const relevant = ranked.filter((candidate) => candidate.relevance > 0)
  if (relevant.length > 0) return relevant

  const firstByKind = new Map<ResearchSource, SearchCandidate>()
  for (const candidate of ranked) if (!firstByKind.has(candidate.kind)) firstByKind.set(candidate.kind, candidate)
  const diverse = ranked.filter((candidate) => firstByKind.get(candidate.kind) === candidate)
  const selected = new Set(diverse.map((candidate) => candidate.url))
  return [...diverse, ...ranked.filter((candidate) => !selected.has(candidate.url))]
}

export function selectDiscoveryResults(
  batches: SearchBatch[],
  enabledSources: ResearchSource[] = ["quran", "hadith", "web"],
): SearchCandidate[] {
  return rankSearchCandidates(batches, enabledSources).slice(0, MAX_DISCOVERY_RESULTS)
}

export function selectVisibleSearchResults(
  batches: SearchBatch[],
  citableCandidates: SearchCandidate[],
): SearchCandidate[] {
  const trustedByIdentity = new Map(
    citableCandidates.map((candidate) => [candidateIdentity(candidate.title, candidate.url, candidate.kind), candidate]),
  )
  const visible = new Map<string, SearchCandidate>()
  const batchIdentities: string[][] = []

  for (const batch of batches) {
    const identities: string[] = []
    for (const hit of batch.results) {
      let url = canonicalUrl(hit.url)
      if (!url) continue
      const parsed = new URL(url)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue
      const domain = parsed.hostname.replace(/^www\./, "")
      const kind = sourceKind(domain)
      if (kind === "quran" || kind === "hadith") {
        parsed.search = ""
        url = parsed.toString()
      }
      const identity = candidateIdentity(hit.title, url, kind)
      if (!identities.includes(identity)) identities.push(identity)
      const trusted = trustedByIdentity.get(identity)
      const existing = visible.get(identity)
      if (existing) {
        existing.matchedQueries += 1
        existing.score += Math.min(Math.max(hit.score, 0), 10)
        if (trusted && existing.role === "discovery") visible.set(identity, { ...trusted, matchedQueries: existing.matchedQueries })
        continue
      }

      if (trusted) {
        visible.set(identity, trusted)
        continue
      }

      const source = classifyDomain(url)
      visible.set(identity, {
        url,
        title: hit.title,
        snippet: hit.snippet.slice(0, 600),
        ...(hit.publishedDate ? { publishedDate: hit.publishedDate } : {}),
        domain,
        faviconUrl: `${parsed.origin}/favicon.ico`,
        tier: "C",
        role: "discovery",
        topics: source?.topics ?? [],
        source: source?.name ?? domain,
        kind,
        matchedQueries: 1,
        relevance: relevanceScore(hit, batch.query),
        score: Math.min(Math.max(hit.score, 0), 10),
      })
    }
    batchIdentities.push(identities)
  }

  const selectedIdentities: string[] = []
  const selected = new Set<string>()
  const add = (identity: string) => {
    if (selected.size >= MAX_DISCOVERY_RESULTS || selected.has(identity) || !visible.has(identity)) return
    selected.add(identity)
    selectedIdentities.push(identity)
  }

  for (const identity of batchIdentities[0]?.slice(0, 10) ?? []) add(identity)
  const remaining = batchIdentities.map((identities) => identities.filter((identity) => !selected.has(identity)))
  let added = true
  for (let index = 0; selected.size < MAX_DISCOVERY_RESULTS && added; index++) {
    added = false
    for (const identities of remaining) {
      const identity = identities[index]
      if (identity && !selected.has(identity)) {
        add(identity)
        added = true
      }
    }
  }

  return selectedIdentities.map((identity) => visible.get(identity)).filter((candidate): candidate is SearchCandidate => Boolean(candidate))
}

function evidenceGroup(candidate: SearchCandidate): string {
  const parsed = new URL(candidate.url)
  const firstPathPart = parsed.pathname.split("/").filter(Boolean)[0] ?? parsed.hostname
  if (candidate.kind === "web") return `${candidate.kind}:${parsed.hostname}`
  return `${candidate.kind}:${firstPathPart.split(":")[0]}`
}

export function selectFetchCandidates(candidates: SearchCandidate[], limit: number): SearchCandidate[] {
  if (limit <= 0 || candidates.length === 0) return []
  const kindOrder: ResearchSource[] = ["quran", "hadith", "web"]
  const availableKinds = kindOrder.filter((kind) => candidates.some((candidate) => candidate.kind === kind))
  const quota = Math.ceil(limit / availableKinds.length)
  const byKind = new Map<ResearchSource, SearchCandidate[]>()

  for (const kind of availableKinds) {
    const bucket = candidates.filter((candidate) => candidate.kind === kind)
    const seenGroups = new Set<string>()
    const diverse = bucket.filter((candidate) => {
      const group = evidenceGroup(candidate)
      if (seenGroups.has(group)) return false
      seenGroups.add(group)
      return true
    })
    const diverseUrls = new Set(diverse.map((candidate) => candidate.url))
    byKind.set(kind, [...diverse, ...bucket.filter((candidate) => !diverseUrls.has(candidate.url))].slice(0, quota))
  }

  const selected: SearchCandidate[] = []
  for (let index = 0; index < quota && selected.length < limit; index++) {
    for (const kind of availableKinds) {
      const candidate = byKind.get(kind)?.[index]
      if (candidate) selected.push(candidate)
      if (selected.length === limit) break
    }
  }

  const selectedUrls = new Set(selected.map((candidate) => candidate.url))
  for (const candidate of candidates) {
    if (selected.length === limit) break
    if (!selectedUrls.has(candidate.url)) {
      selected.push(candidate)
      selectedUrls.add(candidate.url)
    }
  }
  return selected
}

export async function searchPrioritySources(
  query: string,
  enabledSources: ResearchSource[] = ["quran", "hadith", "web"],
): Promise<{ queries: string[]; batches: SearchBatch[]; candidates: SearchCandidate[] }> {
  const queries = buildPrioritySearchQueries(query)
  const batches = await Promise.all(
    queries.map(async (searchQuery) => {
      const response = await searchFirecrawl(
        { query: searchQuery, limit: SEARCH_RESULTS_PER_QUERY },
        { firecrawlUrl: env.FIRECRAWL_URL, firecrawlApiKey: env.FIRECRAWL_API_KEY },
      )
      return { query: searchQuery, results: response.results }
    }),
  )

  return { queries, batches, candidates: selectDiscoveryResults(batches, enabledSources) }
}

export function createSearchSourcesTool(options: {
  question?: string
  queryCount: number
  sources?: ResearchSource[]
  onCandidates?: (candidates: SearchCandidate[]) => void
  onSearchResults?: (research: { generatedQueries: string[]; queries: string[]; sources: SearchCandidate[] }) => void
}) {
  const queryLimit = Math.min(3, Math.max(1, options.queryCount))
  return tool({
    description: `Generate one to three short, keyword-based search queries and run them in parallel. Do not split a simple question merely to fill the query budget. For a multi-part question, give each query a distinct evidence need. Use natural search terms rather than labels such as "Quran evidence" or "scholarly ruling". Returns trusted candidates after relevance, page-quality, authority, and source-policy ranking; these remain leads until fetchSources reads them.`,
    inputSchema: z.object({
      queries: z.array(z.string().min(3)).min(1).max(queryLimit).describe(`One to ${queryLimit} concise, distinct search queries`),
    }),
    execute: async ({ queries }) => {
      const routedQueries = routeSearchQueries(queries, options.question)
      let batches = await Promise.all(
        routedQueries.map(async (query) => {
          const response = await searchFirecrawl(
            { query, limit: SEARCH_RESULTS_PER_QUERY },
            { firecrawlUrl: env.FIRECRAWL_URL, firecrawlApiKey: env.FIRECRAWL_API_KEY },
          )
          return { query, results: response.results }
        }),
      )
      let candidates = selectDiscoveryResults(batches, options.sources)
      if (candidates.length === 0 && options.question) {
        const attempted = new Set(routedQueries)
        const fallbackRequests = buildFocusedSearchRequests(options.question).filter((request) => !attempted.has(request.query))
        const fallbackBatches = await Promise.all(
          fallbackRequests.map(async (request) => {
            const response = await searchFirecrawl(
              { ...request, limit: SEARCH_RESULTS_PER_QUERY },
              { firecrawlUrl: env.FIRECRAWL_URL, firecrawlApiKey: env.FIRECRAWL_API_KEY },
            )
            return { query: request.query, results: response.results }
          }),
        )
        batches = [...batches, ...fallbackBatches]
        candidates = selectDiscoveryResults(batches, options.sources)
      }
      options.onCandidates?.(candidates)
      options.onSearchResults?.({
        generatedQueries: queries,
        queries: batches.map((batch) => batch.query),
        sources: selectVisibleSearchResults(batches, candidates),
      })
      return candidates
    },
  })
}
