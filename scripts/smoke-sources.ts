import { filterToAllowlist } from "../packages/core/src/tools/sourceRegistry"
import {
  buildPrioritySearchQueries,
  rankSearchCandidates,
  searchSearxng,
} from "../packages/core/src/tools/webSearch"

const searxngUrl = process.env.SEARXNG_URL ?? "http://localhost:18888"
const query = process.argv.slice(2).join(" ") || "ruling on combining prayers while traveling"
const queries = buildPrioritySearchQueries(query)

const batches = await Promise.all(
  queries.map(async (searchQuery) => {
    const response = await searchSearxng({ query: searchQuery, limit: 12 }, { searxngUrl })
    return { query: searchQuery, results: response.results }
  }),
)

const raw = batches.flatMap((batch) => batch.results)
const { citable, leads, rejected } = filterToAllowlist(raw)
const ranked = rankSearchCandidates(batches).slice(0, 12)

console.log(`query: ${query}`)
console.log(`searched ${queries.length} queries · ${raw.length} raw · ${citable.length} citable · ${leads.length} leads · ${rejected.length} rejected`)

console.log("\nqueries:")
for (const searchQuery of queries) console.log(`  - ${searchQuery}`)

console.log("\nranked sources:")
for (const source of ranked) {
  console.log(`  [${source.tier}/${source.role}] ${source.source} · relevance ${source.relevance.toFixed(2)} · score ${source.score.toFixed(2)} · ${source.matchedQueries} quer${source.matchedQueries === 1 ? "y" : "ies"}`)
  console.log(`      ${source.title}`)
  console.log(`      ${source.url}`)
}

console.log(`\nexcluded ${leads.length} social leads and ${rejected.length} unapproved results`)
