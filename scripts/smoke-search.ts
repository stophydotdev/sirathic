import { searchSearxng } from "../packages/core/src/tools/webSearch"

const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const queries = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["islamqa fasting", "witr prayer odd number"]

for (const query of queries) {
  console.log(`\n# ${query}`)
  const started = performance.now()

  try {
    const res = await searchSearxng({ query, limit: 8 }, { searxngUrl })
    console.log(`  ${Math.round(performance.now() - started)}ms · ${res.results.length} results`)

    if (res.unresponsiveEngines.length > 0) {
      console.log(`  degraded: ${res.unresponsiveEngines.map((e) => `${e.engine} (${e.reason})`).join(", ")}`)
    }

    if (res.results.length === 0) {
      console.log("  (no results)")
      continue
    }

    for (const hit of res.results) {
      console.log(`  [${hit.score.toFixed(2)}] ${hit.title}`)
      console.log(`         ${hit.url}  (${hit.engines.join(", ")})`)
    }
  } catch (error) {
    console.log(`  error: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`  is the external SearXNG service reachable at ${searxngUrl}?`)
    process.exit(1)
  }
}
