import { chatModel } from "@sirathic/llm"
import { env } from "@sirathic/env/server"
import { generateObject, generateText, streamText } from "ai"
import { z } from "zod"
import { ANSWER_PROMPT } from "./prompt"
import { hasPerplexityAnswerShape, normalizePerplexityAnswerShape, stripInvalidCitationPassages, validateCitations } from "./citations"
import { formatSources, numberSources, webToSource } from "./source"
import { fetchUrl } from "./tools/webFetch"
import { buildFocusedSearchRequests, planResearchQueries, rankSearchCandidates, SEARCH_RESULTS_PER_QUERY, searchFirecrawl, selectDiscoveryResults, selectFetchCandidates, selectVisibleSearchResults } from "./tools/webSearch"
import { isRegisteredSourceDomain } from "./tools/sourceRegistry"
import type { AskEventEmitter, AskOptions, AskResult, GatherResult, PublicSearchResult, RawSource, ResearchComplexity, ResearchIntent, ResearchMode, ResearchPolicy, ResearchSource, ResearchTrace, SearchCandidate, SearchOptions, Source } from "./types"

const RESEARCH_POLICIES: Record<ResearchMode, ResearchPolicy> = {
  speed: { initialQueryMin: 1, initialQueryMax: 2, maxSearchRounds: 1, initialFetches: 3, extraFetches: 0 },
  balanced: { initialQueryMin: 1, initialQueryMax: 3, maxSearchRounds: 2, initialFetches: 6, extraFetches: 2 },
  quality: { initialQueryMin: 1, initialQueryMax: 3, maxSearchRounds: 2, initialFetches: 8, extraFetches: 2 },
}

const NO_EVIDENCE_ANSWER = "I couldn't find enough relevant, trusted sources to answer this question. Try rephrasing it or use quality mode."
const CITATION_REPAIR_PROMPT = `You are the final citation and formatting editor for Sirathic. Rewrite the draft into a complete Perplexity-style answer using only the supplied Search results.

Requirements:
- Start with a direct prose answer, never a title, heading, label, or list.
- Put citations at the end of every substantive paragraph or bullet. Each citation must support every claim in that passage.
- Keep only valid citation indexes from the supplied results.
- Use short natural paragraphs. Add descriptive level-2 sections only when useful; use lists only for genuine steps or comparisons.
- Remove unsupported claims, malformed markdown, repetition, empty headings, and incomplete sections.
- Do not include raw URLs, a bibliography, or a Sources section.`
const RESEARCH_AGENT_PROMPT = `You are Sirathic's adaptive search planner. Create the smallest useful first search round and related searches the user may want next.

Requirements:
- Classify the question's intent and whether it is simple or genuinely multi-part.
- Use one short query for a simple question when that is sufficient. Use at most three queries when distinct concepts or evidence needs must be covered.
- Write concise, natural, keyword-based search queries. Do not add planner labels such as "Quran evidence", "Hadith evidence", or "scholarly ruling".
- Preserve the user's core subject, but introduce established Islamic terminology when it improves discovery.
- Do not add site: filters in the first round unless the user requested a specific source.
- Related searches must be concise standalone questions, directly relevant, and must not repeat the original question.
- Do not answer the question. Return only the requested structured plan.`

const FOLLOWUP_SEARCH_PROMPT = `You are Sirathic's adaptive search planner. The first search round did not provide every trusted evidence lane needed to answer the question.

Requirements:
- Generate only the missing searches, never repeat an attempted query.
- Use one to three short, keyword-based queries.
- Return domain restrictions separately in the domains field; never put site: or a domain name in the query text.
- Prefer quran.com for direct ayat, sunnah.com for individual hadith, and a relevant trusted scholarly or guidance domain for expert explanation.
- Preserve the user's actual subject and use SEO-friendly keyword phrases rather than full sentences.
- Translate conversational wording into vocabulary likely to occur in the target source. Do not search sacred texts for vague adjectives such as "great" when concepts such as righteous believers, faith, good deeds, character, patience, or worship express the intent.
- Example for "how to become a great Muslim": { query: "qualities righteous believers faith good deeds character", domains: ["quran.com"] }, { query: "best Muslims good character faith deeds", domains: ["sunnah.com"] }, { query: "how to become a better Muslim practical steps", domains: ["islamqa.info"] }.
- Do not answer the question.`

type ResearchPlan = {
  intent: ResearchIntent
  complexity: ResearchComplexity
  queries: string[]
  relatedQuestions: string[]
}

export function getResearchPolicy(mode: ResearchMode): ResearchPolicy {
  return RESEARCH_POLICIES[mode]
}

export function searchDeadline(mode: ResearchMode): number {
  // Firecrawl fans each request into its internal search service. Give the
  // private Railway hop enough room without letting one query stall research.
  if (mode === "quality") return 15_000
  return 10_000
}

export function answerTokenBudget(mode: ResearchMode): number {
  if (mode === "speed") return 600
  if (mode === "quality") return 2_200
  return 1_600
}

async function generateResearchPlan(
  question: string,
  opts: AskOptions,
  policy: ResearchPolicy,
): Promise<ResearchPlan> {
  const fallbackQueries = planResearchQueries(question, opts.mode ?? "balanced")
  const fallback = {
    intent: inferResearchIntent(question),
    complexity: inferResearchComplexity(question),
    queries: fallbackQueries.slice(0, policy.initialQueryMax),
    relatedQuestions: [],
  } satisfies ResearchPlan
  try {
    const schema = z.object({
      intent: z.enum(["ruling", "belief_explanation", "spiritual_guidance", "practical_guidance", "counseling", "biography", "comparison"]),
      complexity: z.enum(["simple", "multi_part"]),
      queries: z.array(z.object({
        query: z.string().min(3).max(160),
        purpose: z.string().min(3).max(120),
      })).min(policy.initialQueryMin).max(policy.initialQueryMax),
      related_questions: z.array(z.string().min(8).max(160)).max(5),
    })
    const result = await generateObject({
      model: chatModel(opts.model, { provider: opts.provider }),
      system: RESEARCH_AGENT_PROMPT,
      prompt: `Question: ${question}\nMode: ${opts.mode ?? "balanced"}\nAllowed first-round queries: ${policy.initialQueryMin}-${policy.initialQueryMax}\n\nFallback examples if useful:\n${fallbackQueries.map((query) => `- ${query}`).join("\n")}`,
      schema,
      temperature: 0,
      maxOutputTokens: 500,
    })
    const queries = normalizeQueries(result.object.queries.map((entry) => entry.query), policy.initialQueryMax)
    const relatedQuestions = [...new Set(result.object.related_questions.map((item) => item.trim()))].slice(0, 5)
    if (queries.length < policy.initialQueryMin) return fallback
    return { intent: result.object.intent, complexity: result.object.complexity, queries, relatedQuestions }
  } catch {
    return fallback
  }
}

function normalizeQueries(queries: string[], limit = 3): string[] {
  const normalized = queries.map((query) => query.trim().replace(/\s+/g, " ")).filter((query) => query.length >= 3)
  return [...new Map(normalized.map((query) => [query.toLowerCase(), query])).values()].slice(0, limit)
}

function inferResearchIntent(question: string): ResearchIntent {
  const normalized = question.toLowerCase()
  if (/\b(?:who is|who was|biograph(?:y|ical)|life of)\b|(?:سيرة|من هو)/u.test(normalized)) return "biography"
  if (/anxiety|abuse|conflict|counsel|depress|lonely|mental health|overwhelm|stress|قلق|اكتئاب|وسواس|إساءة/u.test(normalized)) return "counseling"
  if (/compare|difference|differ|madhhab|school holds|خلاف|مذهب/u.test(normalized)) return "comparison"
  if (/halal|haram|allowed|forbidden|permissible|obligatory|ruling|valid|invalidate|حلال|حرام|حكم|يجوز/u.test(normalized)) return "ruling"
  if (/good life|meaning of life|purpose of life|spiritual|faith|iman|إيمان|معنى الحياة|الهدف من الحياة/u.test(normalized)) return "spiritual_guidance"
  if (/\bhow (?:can|do|should|to)\b|routine|habit|plan|practice|step by step|كيف/u.test(normalized)) return "practical_guidance"
  return "belief_explanation"
}

function inferResearchComplexity(question: string): ResearchComplexity {
  const parts = question.split(/[?؟]/u).filter((part) => part.trim().length > 0)
  return parts.length > 1 || /\b(?:compare|versus|vs\.?|and why|and how|differences? between)\b/iu.test(question)
    ? "multi_part"
    : "simple"
}

export function researchCoverageGaps(
  candidates: SearchCandidate[],
  enabledSources: ResearchSource[] = ["quran", "hadith", "web"],
  intent: ResearchIntent = "belief_explanation",
): string[] {
  const enabled = new Set(enabledSources)
  const gaps: string[] = []
  if (candidates.length < 3) gaps.push("at least three relevant trusted candidates")

  const primaryEnabled = enabled.has("quran") || enabled.has("hadith")
  const hasPrimary = candidates.some((candidate) => candidate.kind === "quran" || candidate.kind === "hadith")
  if (primaryEnabled && intent !== "biography" && !hasPrimary) gaps.push("direct Quran or authenticated hadith evidence")

  if (enabled.has("web")) {
    const roles = new Set(candidates.map((candidate) => candidate.role))
    if (intent === "ruling" && !roles.has("fatwa")) gaps.push("an individual trusted fatwa")
    else if (intent === "counseling" && !roles.has("counseling") && !roles.has("guidance")) gaps.push("trusted counseling or guidance")
    else if (intent !== "ruling" && intent !== "counseling" && !candidates.some((candidate) => candidate.kind === "web" && candidate.role !== "discovery")) {
      gaps.push("a trusted scholarly explanation or guidance page")
    }
  }
  return [...new Set(gaps)]
}

async function generateFollowupQueries(
  question: string,
  opts: AskOptions,
  plan: ResearchPlan,
  candidates: SearchCandidate[],
  attemptedQueries: string[],
  gaps: string[],
): Promise<SearchOptions[]> {
  const attempted = new Set(attemptedQueries.map((query) => query.toLowerCase()))
  const fallback = buildFocusedSearchRequests(question).filter((request) => !attempted.has(request.query.toLowerCase()))
  try {
    const schema = z.object({
      queries: z.array(z.object({
        query: z.string().min(3).max(160),
        purpose: z.string().min(3).max(120),
        domains: z.array(z.string().min(3).max(120)).max(3),
      })).min(1).max(3),
    })
    const result = await generateObject({
      model: chatModel(opts.model, { provider: opts.provider }),
      system: FOLLOWUP_SEARCH_PROMPT,
      prompt: `Question: ${question}\nIntent: ${plan.intent}\nMissing evidence: ${gaps.join("; ")}\n\nAttempted queries:\n${attemptedQueries.map((query) => `- ${query}`).join("\n")}\n\nBest trusted candidates so far:\n${candidates.slice(0, 8).map((candidate) => `- ${candidate.title} (${candidate.domain}, ${candidate.role})`).join("\n") || "- none"}`,
      schema,
      temperature: 0,
      maxOutputTokens: 300,
    })
    const searches = result.object.queries.map((entry): SearchOptions => {
      const operatorDomains = entry.query.match(/\bsite:([^\s]+)/giu)?.map((operator) => operator.slice(5).toLowerCase()) ?? []
      const query = entry.query.replace(/\bsite:[^\s]+/giu, " ").replace(/\s+/g, " ").trim()
      const includeDomains = [...new Set([...entry.domains.map((domain) => domain.toLowerCase().replace(/^www\./, "")), ...operatorDomains])]
        .filter(isRegisteredSourceDomain)
      return { query, ...(includeDomains.length ? { includeDomains } : {}) }
    }).filter((request) => request.query.length >= 3 && !attempted.has(request.query.toLowerCase()))
    const filled = [...new Map(searches.map((request) => [`${request.query.toLowerCase()}|${request.includeDomains?.join(",") ?? ""}`, request])).values()]
    const usedDomains = new Set(filled.flatMap((request) => request.includeDomains ?? []))
    for (const request of fallback) {
      if (filled.length === 3) break
      if (request.includeDomains?.some((domain) => usedDomains.has(domain))) continue
      filled.push(request)
      for (const domain of request.includeDomains ?? []) usedDomains.add(domain)
    }
    return filled.slice(0, 3)
  } catch {
    return fallback
  }
}

export async function gather(question: string, opts: AskOptions = {}, emit?: AskEventEmitter): Promise<GatherResult> {
  const mode = opts.mode ?? "balanced"
  const policy = getResearchPolicy(mode)
  const plan = await generateResearchPlan(question, { ...opts, mode }, policy)
  const generatedQueries = [...plan.queries]
  const prefetched = new Map<string, Promise<RawSource | undefined>>()
  const runQueries = (searchRequests: SearchOptions[]) => Promise.all(
    searchRequests.map(async (request) => {
      try {
        const response = await searchFirecrawl(
          { ...request, limit: SEARCH_RESULTS_PER_QUERY, timeoutMs: searchDeadline(mode) },
          { firecrawlUrl: env.FIRECRAWL_URL, firecrawlApiKey: env.FIRECRAWL_API_KEY },
        )
        const earlyCandidate = rankSearchCandidates([{ query: request.query, results: response.results }], opts.sources)[0]
        if (earlyCandidate && !prefetched.has(earlyCandidate.url)) {
          prefetched.set(earlyCandidate.url, fetchCandidate(earlyCandidate).catch(() => undefined))
        }
        return { query: request.query, results: response.results, error: undefined }
      } catch (error) {
        return { query: request.query, results: [], error }
      }
    }),
  )
  let allAttempts = await runQueries(plan.queries.map((query) => ({ query })))
  let batches = allAttempts.map(({ query, results }) => ({ query, results }))
  let candidates = selectDiscoveryResults(batches, opts.sources)
  const gaps = researchCoverageGaps(candidates, opts.sources, plan.intent)
  if (policy.maxSearchRounds > 1 && gaps.length > 0) {
    const followupSearches = await generateFollowupQueries(
      question,
      { ...opts, mode },
      plan,
      candidates,
      batches.map((batch) => batch.query),
      gaps,
    )
    generatedQueries.push(...followupSearches.map((search) => search.query))
    const retryAttempts = await runQueries(followupSearches)
    allAttempts = [...allAttempts, ...retryAttempts]
    batches = [...batches, ...retryAttempts.map(({ query, results }) => ({ query, results }))]
    candidates = selectDiscoveryResults(batches, opts.sources)
  }
  if (allAttempts.every((attempt) => attempt.error !== undefined)) {
    throw new Error("Trusted search is temporarily unavailable. Please try again.", {
      cause: allAttempts[0]?.error,
    })
  }
  const visibleCandidates = selectVisibleSearchResults(batches, candidates)
  const research: ResearchTrace = { generatedQueries, queries: batches.map((batch) => batch.query), sources: visibleCandidates }
  await emit?.({ type: "search-results", ...research })
  await emit?.({ type: "tool-complete", tools: ["searchSources"], found: visibleCandidates.length })

  const fetchQueue = selectFetchCandidates(candidates, policy.initialFetches + policy.extraFetches)
  const collected = await fetchCandidates(fetchQueue.slice(0, policy.initialFetches), prefetched)
  if (collected.length < policy.initialFetches && policy.extraFetches > 0) {
    collected.push(...await fetchCandidates(fetchQueue.slice(policy.initialFetches), prefetched))
  }
  await emit?.({ type: "tool-complete", tools: ["fetchSources"], found: collected.length })
  return { sources: numberSources(collected), research, related_questions: plan.relatedQuestions }
}

async function fetchCandidate(candidate: SearchCandidate): Promise<RawSource | undefined> {
  const result = await fetchUrl({ url: candidate.url })
  if (!result.ok) return undefined
  return webToSource({
    url: result.finalUrl,
    title: result.title || candidate.title,
    tier: candidate.tier,
    role: candidate.role,
    source: candidate.source,
    kind: candidate.kind,
    faviconUrl: candidate.faviconUrl,
    text: result.markdown,
  })
}

async function fetchCandidates(
  candidates: SearchCandidate[],
  prefetched: Map<string, Promise<RawSource | undefined>> = new Map(),
): Promise<RawSource[]> {
  const results = await Promise.all(
    candidates.map((candidate) => prefetched.get(candidate.url) ?? fetchCandidate(candidate)),
  )
  return results.filter((result): result is RawSource => Boolean(result))
}

function answerRequest(
  question: string,
  sources: Source[],
  opts: AskOptions,
  model = chatModel(opts.model, { provider: opts.provider }),
  maxOutputTokens = answerTokenBudget(opts.mode ?? "balanced"),
) {
  return {
    model,
    system: ANSWER_PROMPT,
    prompt: `Query: ${question}\n\nSearch results:\n${formatSources(sources)}`,
    maxOutputTokens,
    temperature: 0,
  }
}

async function generateAnswer(
  question: string,
  sources: Source[],
  opts: AskOptions,
  system = ANSWER_PROMPT,
  prompt?: string,
  maxOutputTokens?: number,
) {
  return generateText({
    ...answerRequest(question, sources, opts, undefined, maxOutputTokens),
    system,
    ...(prompt ? { prompt } : {}),
  })
}

async function completeAnswer(
  question: string,
  sources: Source[],
  opts: AskOptions,
  answer: string,
  finishReason: string,
): Promise<string> {
  if (finishReason !== "length") return enforceCitations(question, answer, sources, opts)

  const retryBudget = Math.max(answerTokenBudget(opts.mode ?? "balanced") * 2, 1_200)
  const retry = await generateAnswer(
    question,
    sources,
    opts,
    `${ANSWER_PROMPT}\n\nCompletion requirement: Return a complete answer within the token budget. Never stop mid-sentence or leave a heading unfinished.`,
    undefined,
    retryBudget,
  )
  return enforceCitations(question, retry.text, sources, opts)
}

async function enforceCitations(
  question: string,
  answer: string,
  sources: Source[],
  opts: AskOptions,
): Promise<string> {
  const validation = validateCitations(answer, sources)
  if (validation.valid && hasPerplexityAnswerShape(answer)) return answer

  const groundedDraft = normalizePerplexityAnswerShape(stripInvalidCitationPassages(answer, validation))
  if (
    groundedDraft.length >= 20
    && validateCitations(groundedDraft, sources).valid
    && hasPerplexityAnswerShape(groundedDraft)
  ) return groundedDraft

  const repair = await generateAnswer(
    question,
    sources,
    opts,
    CITATION_REPAIR_PROMPT,
    `Query: ${question}\n\nSearch results:\n${formatSources(sources)}\n\nDraft to repair:\n${answer}`,
    Math.max(answerTokenBudget(opts.mode ?? "balanced"), 900),
  )
  const repairValidation = validateCitations(repair.text, sources)
  if (
    repair.finishReason !== "length"
    && repairValidation.valid
    && hasPerplexityAnswerShape(repair.text)
  ) return repair.text

  const groundedRepair = normalizePerplexityAnswerShape(stripInvalidCitationPassages(repair.text, repairValidation))
  if (
    repair.finishReason !== "length"
    && groundedRepair.length >= 20
    && validateCitations(groundedRepair, sources).valid
    && hasPerplexityAnswerShape(groundedRepair)
  ) return groundedRepair

  return "I found relevant evidence, but could not produce a complete answer with reliable citations. Please try the inquiry again or narrow the question."
}

function resultMetadata(sources: Source[], research: ResearchTrace, relatedQuestions: string[]) {
  const searchResults: PublicSearchResult[] = research.sources.map((candidate) => ({
    title: candidate.title,
    url: candidate.url,
    date: candidate.publishedDate ?? null,
    last_updated: null,
    snippet: candidate.snippet,
    source: "web",
  }))
  return {
    citations: sources.map((source) => source.url),
    search_results: searchResults,
    related_questions: relatedQuestions,
  }
}

function completedResult(
  answer: string,
  sources: Source[],
  research: ResearchTrace,
  relatedQuestions: string[],
): AskResult {
  return { answer, ...resultMetadata(sources, research, relatedQuestions), sources, research }
}

export async function ask(question: string, opts: AskOptions = {}): Promise<AskResult> {
  const { sources, research, related_questions } = await gather(question, opts)
  if (sources.length === 0) return completedResult(NO_EVIDENCE_ANSWER, sources, research, related_questions)
  const result = await generateAnswer(question, sources, opts)
  return completedResult(
    await completeAnswer(question, sources, opts, result.text, result.finishReason),
    sources,
    research,
    related_questions,
  )
}

export async function askStream(question: string, opts: AskOptions = {}) {
  const { sources, research, related_questions } = await gather(question, opts)
  return { sources, research, related_questions, stream: streamText({ ...answerRequest(question, sources, opts), onError: () => {} }) }
}

export async function askWithEvents(
  question: string,
  opts: AskOptions = {},
  emit: AskEventEmitter = () => {},
): Promise<AskResult> {
  const mode = opts.mode ?? "balanced"

  try {
    await emit({ type: "research-start", mode })
    const { sources, research, related_questions } = await gather(question, opts, emit)
    await emit({ type: "sources", sources })

    if (sources.length === 0) {
      await emit({ type: "answer-delta", delta: NO_EVIDENCE_ANSWER })
      const completed = completedResult(NO_EVIDENCE_ANSWER, sources, research, related_questions)
      await emit({ type: "done", ...completed })
      return completed
    }

    let answer = ""
    const result = streamText({ ...answerRequest(question, sources, opts), onError: () => {} })
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        answer += part.text
        await emit({ type: "answer-delta", delta: part.text })
      } else if (part.type === "error") {
        throw part.error
      }
    }

    const validatedAnswer = await completeAnswer(question, sources, opts, answer, await result.finishReason)
    if (validatedAnswer !== answer) {
      answer = validatedAnswer
      await emit({ type: "answer-replace", answer, reason: "citation-validation" })
    }

    const completed = completedResult(answer, sources, research, related_questions)
    await emit({ type: "done", ...completed })
    return completed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await emit({ type: "error", message })
    throw error
  }
}
