import { chatModel } from "@sirathic/llm"
import { generateObject, generateText, streamText } from "ai"
import { z } from "zod"
import { ANSWER_PROMPT } from "./prompt"
import { hasPerplexityAnswerShape, normalizePerplexityAnswerShape, stripInvalidCitationPassages, validateCitations } from "./citations"
import { formatSources, numberSources, webToSource } from "./source"
import { fetchUrl } from "./tools/webFetch"
import { planResearchQueries, rankSearchCandidates, searchSearxng } from "./tools/webSearch"
import type { AskEventEmitter, AskOptions, AskResult, GatherResult, PublicSearchResult, RawSource, ResearchMode, ResearchPolicy, ResearchTrace, SearchCandidate, Source } from "./types"

const RESEARCH_POLICIES: Record<ResearchMode, ResearchPolicy> = {
  speed: { queryCount: 3, initialFetches: 3, extraFetches: 0, maxSteps: 2 },
  balanced: { queryCount: 3, initialFetches: 3, extraFetches: 2, maxSteps: 3 },
  quality: { queryCount: 5, initialFetches: 3, extraFetches: 2, maxSteps: 3 },
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
const RESEARCH_AGENT_PROMPT = `You are Sirathic's research agent. Before any search runs, create the web-search plan and the related searches a user may want next.

Requirements:
- Preserve the user's exact subject and intent in every query.
- Make each query distinct: primary Qur'an evidence, authentic hadith evidence, and the appropriate scholarly or practical expert lane. For quality mode, also include a broad query and a second expert viewpoint.
- Put at most one site:domain filter in each query. Use quran.com for Qur'an, sunnah.com for hadith, and a relevant trusted scholarly domain for expert queries.
- Related searches must be concise standalone questions, directly relevant, and must not repeat the original question.
- Do not answer the question. Return only the requested structured plan.`

export function getResearchPolicy(mode: ResearchMode): ResearchPolicy {
  return RESEARCH_POLICIES[mode]
}

export function searchDeadline(mode: ResearchMode): number {
  // Proxied search engines complete in roughly 0.4–2.0s. Leave enough room
  // for SearXNG to serialize its JSON without turning viable results into a
  // false "no trusted evidence" response.
  if (mode === "quality") return 2_800
  return 2_400
}

export function answerTokenBudget(mode: ResearchMode): number {
  if (mode === "speed") return 600
  if (mode === "quality") return 1_600
  return 900
}

async function generateResearchPlan(
  question: string,
  opts: AskOptions,
  policy: ResearchPolicy,
): Promise<{ queries: string[]; relatedQuestions: string[] }> {
  const fallbackQueries = planResearchQueries(question, opts.mode ?? "balanced")
  try {
    const schema = z.object({
      queries: z.array(z.string().min(3).max(240)).length(policy.queryCount),
      related_questions: z.array(z.string().min(8).max(160)).length(5),
    })
    const result = await generateObject({
      model: chatModel(opts.model, { provider: opts.provider }),
      system: RESEARCH_AGENT_PROMPT,
      prompt: `Question: ${question}\nMode: ${opts.mode ?? "balanced"}\nRequired search count: ${policy.queryCount}\n\nRecommended trusted lanes:\n${fallbackQueries.map((query) => `- ${query}`).join("\n")}`,
      schema,
      temperature: 0,
      maxOutputTokens: 500,
    })
    const queries = result.object.queries.map((query, index) => {
      const trimmed = query.trim().replace(/\s+/g, " ")
      const fallback = fallbackQueries[index] ?? question
      const expectedSiteFilter = /\bsite:\S+/iu.test(fallback)
      const siteFilters = trimmed.match(/\bsite:\S+/giu) ?? []
      if (siteFilters.length > 1 || (expectedSiteFilter && siteFilters.length !== 1)) return fallback
      return trimmed
    })
    const relatedQuestions = [...new Set(result.object.related_questions.map((item) => item.trim()))].slice(0, 5)
    const distinctIntents = new Set(
      queries.map((query) => query.toLowerCase().replace(/\bsite:\S+/giu, "").replace(/\s+/g, " ").trim()),
    )
    if (distinctIntents.size !== queries.length) return { queries: fallbackQueries, relatedQuestions }
    return { queries, relatedQuestions }
  } catch {
    return { queries: fallbackQueries, relatedQuestions: [] }
  }
}

export async function gather(question: string, opts: AskOptions = {}, emit?: AskEventEmitter): Promise<GatherResult> {
  const mode = opts.mode ?? "balanced"
  const policy = getResearchPolicy(mode)
  const { queries, relatedQuestions } = await generateResearchPlan(question, { ...opts, mode }, policy)
  const prefetched = new Map<string, Promise<RawSource | undefined>>()
  const runQueries = (searchQueries: string[]) => Promise.all(
    searchQueries.map(async (query) => {
      try {
        const response = await searchSearxng(
          { query, limit: 12, timeoutMs: searchDeadline(mode) },
          { searxngUrl: process.env.SEARXNG_URL ?? "http://localhost:18888" },
        )
        const earlyCandidate = rankSearchCandidates([{ query, results: response.results }], opts.sources)[0]
        if (earlyCandidate && !prefetched.has(earlyCandidate.url)) {
          prefetched.set(earlyCandidate.url, fetchCandidate(earlyCandidate).catch(() => undefined))
        }
        return { query, results: response.results, error: undefined }
      } catch (error) {
        return { query, results: [], error }
      }
    }),
  )
  const attempts = await runQueries(queries)
  let batches = attempts.map(({ query, results }) => ({ query, results }))
  if (attempts.every((attempt) => attempt.error !== undefined)) {
    throw new Error("Trusted search is temporarily unavailable. Please try again.", {
      cause: attempts[0]?.error,
    })
  }
  let candidates = rankSearchCandidates(batches, opts.sources).slice(0, 12)
  if (candidates.length === 0) {
    const attempted = new Set(queries.map((query) => query.toLowerCase()))
    const retryQueries = planResearchQueries(question, mode).filter((query) => !attempted.has(query.toLowerCase()))
    const retryAttempts = await runQueries(retryQueries)
    batches = [...batches, ...retryAttempts.map(({ query, results }) => ({ query, results }))]
    candidates = rankSearchCandidates(batches, opts.sources).slice(0, 12)
  }
  const research: ResearchTrace = { generatedQueries: queries, queries: batches.map((batch) => batch.query), sources: candidates }
  await emit?.({ type: "search-results", ...research })
  await emit?.({ type: "tool-complete", tools: ["searchSources"], found: candidates.length })

  const collected = await fetchCandidates(candidates.slice(0, policy.initialFetches), prefetched)
  if (collected.length < policy.initialFetches && policy.extraFetches > 0) {
    collected.push(...await fetchCandidates(candidates.slice(policy.initialFetches, policy.initialFetches + policy.extraFetches), prefetched))
  }
  await emit?.({ type: "tool-complete", tools: ["fetchSources"], found: collected.length })
  return { sources: numberSources(collected), research, related_questions: relatedQuestions }
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
  const candidates = new Map(research.sources.map((candidate) => [candidate.url, candidate]))
  const searchResults: PublicSearchResult[] = sources.map((source) => {
    const candidate = candidates.get(source.url)
    return {
      title: candidate?.title ?? source.label,
      url: source.url,
      date: candidate?.publishedDate ?? null,
      last_updated: null,
      snippet: candidate?.snippet ?? source.text.slice(0, 600),
      source: "web",
    }
  })
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
