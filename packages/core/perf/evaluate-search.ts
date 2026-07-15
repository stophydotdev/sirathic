import { planResearchQueries, rankSearchCandidates, searchSearxng } from "../src/tools/webSearch"
import type { ResearchMode, SearchBatch } from "../src/types"
import { searchEvaluationCases } from "./search-evaluation"

type CaseResult = {
  id: string
  category: string
  question: string
  queries: string[]
  latencyMs: number
  rawResults: number
  candidates: number
  candidateDomains: string[]
  expectationHits: Array<{ label: string; hit: boolean; matchedDomain?: string }>
  unresponsiveEngines: string[]
  errors: string[]
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0
}

function matchesDomain(domain: string, expected: string): boolean {
  return domain === expected || domain.endsWith(`.${expected}`)
}

const requestedMode = argument("--mode") ?? "balanced"
if (!(["speed", "balanced", "quality"] as string[]).includes(requestedMode)) {
  throw new Error("--mode must be speed, balanced, or quality")
}
const mode = requestedMode as ResearchMode
const requestedLimit = Number(argument("--limit") ?? searchEvaluationCases.length)
const limit = Number.isFinite(requestedLimit)
  ? Math.max(1, Math.min(searchEvaluationCases.length, Math.floor(requestedLimit)))
  : searchEvaluationCases.length
const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const json = process.argv.includes("--json")
const shouldAssert = process.argv.includes("--assert")
const cases = searchEvaluationCases.slice(0, limit)
const results: CaseResult[] = []

for (const fixture of cases) {
  const queries = planResearchQueries(fixture.question, mode)
  const startedAt = performance.now()
  const attempts = await Promise.all(
    queries.map(async (query) => {
      try {
        const timeoutMs = mode === "quality" ? 1_800 : 1_500
        const response = await searchSearxng({ query, limit: 12, timeoutMs }, { searxngUrl })
        return { query, response, error: undefined }
      } catch (error) {
        return { query, response: undefined, error: error instanceof Error ? error.message : String(error) }
      }
    }),
  )
  const latencyMs = Math.round(performance.now() - startedAt)
  const batches: SearchBatch[] = attempts.map((attempt) => ({ query: attempt.query, results: attempt.response?.results ?? [] }))
  const candidates = rankSearchCandidates(batches).slice(0, 12)
  const candidateDomains = [...new Set(candidates.map((candidate) => candidate.domain))]
  const expectationHits = fixture.expectations.map((expectation) => {
    const matchedDomain = candidateDomains.find((domain) => expectation.domains.some((expected) => matchesDomain(domain, expected)))
    return { label: expectation.label, hit: Boolean(matchedDomain), ...(matchedDomain ? { matchedDomain } : {}) }
  })
  const unresponsiveEngines = [
    ...new Set(attempts.flatMap((attempt) => attempt.response?.unresponsiveEngines.map((entry) => entry.engine) ?? [])),
  ]
  const errors = attempts.flatMap((attempt) => attempt.error ? [`${attempt.query}: ${attempt.error}`] : [])

  results.push({
    id: fixture.id,
    category: fixture.category,
    question: fixture.question,
    queries,
    latencyMs,
    rawResults: batches.reduce((total, batch) => total + batch.results.length, 0),
    candidates: candidates.length,
    candidateDomains,
    expectationHits,
    unresponsiveEngines,
    errors,
  })

  if (!json) {
    const hits = expectationHits.filter((expectation) => expectation.hit).length
    console.log(`${hits === expectationHits.length ? "PASS" : "MISS"} ${fixture.id} · ${hits}/${expectationHits.length} expectations · ${candidates.length} candidates · ${latencyMs}ms`)
  }
}

const expectationCount = results.reduce((total, result) => total + result.expectationHits.length, 0)
const expectationHits = results.reduce(
  (total, result) => total + result.expectationHits.filter((expectation) => expectation.hit).length,
  0,
)
const summary = {
  mode,
  cases: results.length,
  casePassRate: Number((results.filter((result) => result.expectationHits.every((expectation) => expectation.hit)).length / results.length).toFixed(3)),
  expectationRecall: Number((expectationHits / expectationCount).toFixed(3)),
  usefulResultRate: Number((results.filter((result) => result.candidates > 0).length / results.length).toFixed(3)),
  uniqueQueryPlanRate: Number((results.filter((result) => new Set(result.queries).size === result.queries.length).length / results.length).toFixed(3)),
  latencyMs: {
    p50: percentile(results.map((result) => result.latencyMs), 0.5),
    p95: percentile(results.map((result) => result.latencyMs), 0.95),
    max: Math.max(...results.map((result) => result.latencyMs)),
  },
  queryErrors: results.reduce((total, result) => total + result.errors.length, 0),
  degradedEngines: [...new Set(results.flatMap((result) => result.unresponsiveEngines))].sort(),
}

if (json) console.log(JSON.stringify({ summary, results }, null, 2))
else {
  console.log("\nSummary")
  console.log(JSON.stringify(summary, null, 2))
}

if (
  shouldAssert
  && (summary.casePassRate < 0.6
    || summary.expectationRecall < 0.75
    || summary.usefulResultRate < 0.9
    || summary.uniqueQueryPlanRate < 1)
) {
  process.exitCode = 1
}
