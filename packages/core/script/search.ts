import { planResearchQueries, rankSearchCandidates, searchSearxng } from "../src/tools/webSearch"

const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const query = process.argv.slice(2).join(" ").trim()

if (!query) {
  console.error('Usage: bun search "your query"')
  process.exit(1)
}

const started = performance.now()

try {
  const queries = planResearchQueries(query, "balanced")
  const responses = await Promise.all(
    queries.map(async (searchQuery) => {
      try {
        const response = await searchSearxng({ query: searchQuery, limit: 12, timeoutMs: 2_400 }, { searxngUrl })
        return { query: searchQuery, response }
      } catch {
        return { query: searchQuery, response: undefined }
      }
    }),
  )
  const batches = responses.map(({ query: searchQuery, response }) => ({ query: searchQuery, results: response?.results ?? [] }))
  const results = rankSearchCandidates(batches).slice(0, 12)
  const rawCount = batches.reduce((total, batch) => total + batch.results.length, 0)
  console.log(`${Math.round(performance.now() - started)}ms · ${queries.length} queries · ${rawCount} raw · ${results.length} trusted`)

  const degraded = [
    ...new Set(
      responses.flatMap(({ response }) => response?.unresponsiveEngines.map((entry) => `${entry.engine} (${entry.reason})`) ?? []),
    ),
  ]
  if (degraded.length > 0) {
    console.log(`degraded: ${degraded.join(", ")}`)
  }

  for (const result of results) {
    console.log(`\n[${result.tier}/${result.role}] ${result.title}`)
    console.log(result.url)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
