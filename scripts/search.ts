import { MAX_DISCOVERY_RESULTS, searchFirecrawl } from "../packages/core/src/tools/webSearch"

const firecrawlUrl = process.env.FIRECRAWL_URL ?? "http://firecrawl-api.railway.internal:3002"
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
const query = process.argv.slice(2).join(" ").trim()

if (!query) {
  console.error('Usage: bun search "your query"')
  process.exit(1)
}

const started = performance.now()

try {
  const response = await searchFirecrawl(
    { query, limit: MAX_DISCOVERY_RESULTS, timeoutMs: 10_000 },
    { firecrawlUrl, firecrawlApiKey },
  )
  console.log(`${Math.round(performance.now() - started)}ms · ${response.results.length} results`)

  const degraded = response.unresponsiveEngines.map((entry) => `${entry.engine} (${entry.reason})`)
  if (degraded.length > 0) {
    console.log(`degraded: ${degraded.join(", ")}`)
  }

  for (const [index, result] of response.results.entries()) {
    console.log(`\n${index + 1}. [${result.score.toFixed(2)}] ${result.title}`)
    console.log(result.url)
    if (result.snippet) console.log(result.snippet.replace(/\s+/g, " ").trim().slice(0, 240))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
