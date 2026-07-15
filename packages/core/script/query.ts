import { askWithEvents } from "../src/index"
import type { AIProvider, ResearchMode, ResearchSource, Source } from "../src/types"

const validModes = new Set<ResearchMode>(["speed", "balanced", "quality"])
const validSources = new Set<ResearchSource>(["quran", "hadith", "web"])
const validProviders = new Set<AIProvider>(["openai", "openrouter"])
const args = process.argv.slice(2)
const questionParts: string[] = []
let mode: ResearchMode = "balanced"
let sources: ResearchSource[] = ["quran", "hadith", "web"]
let provider: AIProvider | undefined
let model: string | undefined

for (let index = 0; index < args.length; index++) {
  const argument = args[index]
  if (argument === "--mode") {
    const value = args[++index]
    if (!value || !validModes.has(value as ResearchMode)) {
      console.error("--mode must be speed, balanced, or quality")
      process.exit(1)
    }
    mode = value as ResearchMode
  } else if (argument === "--provider") {
    const value = args[++index]
    if (!value || !validProviders.has(value as AIProvider)) {
      console.error("--provider must be openai or openrouter")
      process.exit(1)
    }
    provider = value as AIProvider
  } else if (argument === "--model") {
    const value = args[++index]
    if (!value) {
      console.error("--model requires a model ID")
      process.exit(1)
    }
    model = value
  } else if (argument === "--sources") {
    const value = args[++index]
    const requested = value?.split(",").filter((source): source is ResearchSource => validSources.has(source as ResearchSource)) ?? []
    if (!requested.length) {
      console.error("--sources must contain quran, hadith, and/or web")
      process.exit(1)
    }
    sources = requested
  } else if (argument === "--help" || argument === "-h") {
    console.log('usage: bun query [--provider openai|openrouter] [--model model-id] [--mode speed|balanced|quality] [--sources quran,hadith,web] "your question"')
    process.exit(0)
  } else if (argument) {
    questionParts.push(argument)
  }
}

const question = questionParts.join(" ").trim()
if (!question) {
  console.error('usage: bun query [--provider openai|openrouter] [--model model-id] [--mode speed|balanced|quality] [--sources quran,hadith,web] "your question"')
  process.exit(1)
}

const started = Date.now()
let emittedError = false

function showSources(items: Source[]) {
  console.error(`\n[sources] ${items.length}`)
  for (const source of items) console.error(`  [${source.index}] ${source.label}\n      ${source.url}`)
}

function conciseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const rateLimit = message.match(/Free tier requests on this model are rate-limited[^.]*\.?/i)?.[0]
  return rateLimit ?? message.split("\n")[0] ?? "Query failed"
}

try {
  await askWithEvents(question, { provider, model, mode, sources }, async (event) => {
    if (event.type === "research-start") {
      console.error(`[research] ${event.mode} mode`)
    } else if (event.type === "search-results") {
      console.error(`\n[queries] ${event.queries.length}`)
      for (const query of event.queries) console.error(`  - ${query}`)
      console.error(`\n[discovered] ${event.sources.length}`)
      for (const source of event.sources) console.error(`  - ${source.title}\n    ${source.url}`)
    } else if (event.type === "tool-complete") {
      const action = event.tools.includes("searchSources") ? "ranked candidates" : "pages fetched"
      console.error(`[research] ${event.found} ${action}`)
    } else if (event.type === "sources") {
      showSources(event.sources)
    } else if (event.type === "done") {
      console.log(event.answer)
      console.error(`\n[done] ${((Date.now() - started) / 1_000).toFixed(1)}s`)
    } else if (event.type === "error") {
      emittedError = true
      console.error(`[error] ${conciseError(event.message)}`)
    }
  })
} catch (error) {
  if (!emittedError) console.error(`[error] ${conciseError(error)}`)
  process.exitCode = 1
}
