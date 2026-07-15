import { searchSearxng } from "../src/tools/webSearch"

const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const query = process.argv.slice(2).join(" ").trim()

if (!query) {
  console.error('Usage: bun search "your query"')
  process.exit(1)
}

const started = performance.now()

try {
  const response = await searchSearxng({ query, limit: 12, timeoutMs: 2_400 }, { searxngUrl })
  console.log(`${Math.round(performance.now() - started)}ms · ${response.results.length} results`)

  const degraded = response.unresponsiveEngines.map((entry) => `${entry.engine} (${entry.reason})`)
  if (degraded.length > 0) {
    console.log(`degraded: ${degraded.join(", ")}`)
  }

  for (const result of response.results) {
    console.log(`\n[${result.score.toFixed(2)}] ${result.title}`)
    console.log(result.url)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
