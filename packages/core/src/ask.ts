import { chatModel } from "@sirathic/llm"
import { generateText, streamText } from "ai"
import { ANSWER_PROMPT } from "./prompt"
import { stripInvalidCitationPassages, validateCitations } from "./citations"
import { formatSources, numberSources, webToSource } from "./source"
import { fetchUrl } from "./tools/webFetch"
import { buildPrioritySearchQueries, rankSearchCandidates, routeSearchQueries, searchSearxng } from "./tools/webSearch"
import type { AskEventEmitter, AskOptions, AskResult, GatherResult, RawSource, ResearchMode, ResearchPolicy, ResearchTrace, SearchCandidate, Source } from "./types"

const RESEARCH_POLICIES: Record<ResearchMode, ResearchPolicy> = {
  speed: { queryCount: 3, initialFetches: 3, extraFetches: 0, maxSteps: 2 },
  balanced: { queryCount: 3, initialFetches: 3, extraFetches: 2, maxSteps: 3 },
  quality: { queryCount: 5, initialFetches: 3, extraFetches: 2, maxSteps: 3 },
}

const NO_EVIDENCE_ANSWER = "I couldn't find enough relevant, trusted sources to answer this question. Try rephrasing it or use quality mode."

export function getResearchPolicy(mode: ResearchMode): ResearchPolicy {
  return RESEARCH_POLICIES[mode]
}

export function searchDeadline(mode: ResearchMode): number {
  // SearXNG's upstream engine budget is 1.1s. Leave enough room for its JSON
  // response and local/proxy network overhead without turning a slow engine
  // into a false "no trusted evidence" result.
  if (mode === "quality") return 1_800
  return 1_500
}

export function answerTokenBudget(mode: ResearchMode): number {
  if (mode === "speed") return 300
  if (mode === "quality") return 1_400
  return 700
}

export async function gather(question: string, opts: AskOptions = {}, emit?: AskEventEmitter): Promise<GatherResult> {
  const mode = opts.mode ?? "balanced"
  const policy = getResearchPolicy(mode)
  const querySlots = Array.from({ length: policy.queryCount }, () => question)
  const queries = policy.queryCount === 5
    ? buildPrioritySearchQueries(question)
    : routeSearchQueries(querySlots, question)
  const prefetched = new Map<string, Promise<RawSource | undefined>>()
  const attempts = await Promise.all(
    queries.map(async (query) => {
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
  const batches = attempts.map(({ query, results }) => ({ query, results }))
  if (attempts.every((attempt) => attempt.error !== undefined)) {
    throw new Error("Trusted search is temporarily unavailable. Please try again.", {
      cause: attempts[0]?.error,
    })
  }
  const candidates = rankSearchCandidates(batches, opts.sources).slice(0, 12)
  const research: ResearchTrace = { generatedQueries: queries, queries, sources: candidates }
  await emit?.({ type: "search-results", ...research })
  await emit?.({ type: "tool-complete", tools: ["searchSources"], found: candidates.length })

  const collected = await fetchCandidates(candidates.slice(0, policy.initialFetches), prefetched)
  if (collected.length < policy.initialFetches && policy.extraFetches > 0) {
    collected.push(...await fetchCandidates(candidates.slice(policy.initialFetches, policy.initialFetches + policy.extraFetches), prefetched))
  }
  await emit?.({ type: "tool-complete", tools: ["fetchSources"], found: collected.length })
  return { sources: numberSources(collected), research }
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
) {
  return {
    model,
    system: ANSWER_PROMPT,
    prompt: `Query: ${question}\n\nSearch results:\n${formatSources(sources)}`,
    maxOutputTokens: answerTokenBudget(opts.mode ?? "balanced"),
    temperature: 0,
  }
}

async function generateAnswer(question: string, sources: Source[], opts: AskOptions, system = ANSWER_PROMPT, prompt?: string) {
  return generateText({
    ...answerRequest(question, sources, opts),
    system,
    ...(prompt ? { prompt } : {}),
  })
}

async function enforceCitations(
  answer: string,
  sources: Source[],
): Promise<string> {
  const validation = validateCitations(answer, sources)
  if (validation.valid) return answer

  const sanitized = stripInvalidCitationPassages(answer, validation)
  if (sanitized.length >= 20 && validateCitations(sanitized, sources).valid) return sanitized

  return "I found relevant evidence, but the draft did not meet Sirathic's citation requirements. Please try the inquiry again or narrow the question."
}

export async function ask(question: string, opts: AskOptions = {}): Promise<AskResult> {
  const { sources, research } = await gather(question, opts)
  if (sources.length === 0) return { answer: NO_EVIDENCE_ANSWER, sources, research }
  const result = await generateAnswer(question, sources, opts)
  return { answer: await enforceCitations(result.text, sources), sources, research }
}

export async function askStream(question: string, opts: AskOptions = {}) {
  const { sources, research } = await gather(question, opts)
  return { sources, research, stream: streamText({ ...answerRequest(question, sources, opts), onError: () => {} }) }
}

export async function askWithEvents(
  question: string,
  opts: AskOptions = {},
  emit: AskEventEmitter = () => {},
): Promise<AskResult> {
  const mode = opts.mode ?? "balanced"

  try {
    await emit({ type: "research-start", mode })
    const { sources, research } = await gather(question, opts, emit)
    await emit({ type: "sources", sources })

    if (sources.length === 0) {
      await emit({ type: "answer-delta", delta: NO_EVIDENCE_ANSWER })
      const completed = { answer: NO_EVIDENCE_ANSWER, sources, research }
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

    const validatedAnswer = await enforceCitations(answer, sources)
    if (validatedAnswer !== answer) {
      answer = validatedAnswer
      await emit({ type: "answer-replace", answer, reason: "citation-validation" })
    }

    const completed = { answer, sources, research }
    await emit({ type: "done", ...completed })
    return completed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await emit({ type: "error", message })
    throw error
  }
}
