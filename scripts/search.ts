import { searchSearxng } from "../packages/core/src/tools/webSearch"

const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const query = process.argv.slice(2).join(" ").trim()

if (!query) {
  console.error('Usage: bun search "your query"')
  process.exit(1)
}

const started = performance.now()

try {
  const response = await searchSearxng({ query, limit: 8 }, { searxngUrl })
  console.log(`${Math.round(performance.now() - started)}ms · ${response.results.length} results`)

  if (response.unresponsiveEngines.length > 0) {
    console.log(`degraded: ${response.unresponsiveEngines.map((entry) => `${entry.engine} (${entry.reason})`).join(", ")}`)
  }

  for (const hit of response.results) {
    console.log(`\n[${hit.score.toFixed(2)}] ${hit.title}`)
    console.log(hit.url)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
