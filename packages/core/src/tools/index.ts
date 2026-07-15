import type { ToolSet } from "ai"
import type { BuildToolsOptions } from "../types"
import { createFetchSourcesTool } from "./webFetch"
import { createSearchSourcesTool } from "./webSearch"

export function buildTools(options: BuildToolsOptions = {}): ToolSet {
  const queryCount = options.queryCount ?? 3
  const initialFetches = options.initialFetches ?? 3
  const extraFetches = options.extraFetches ?? 0
  const candidateUrls = new Set<string>()

  return {
    searchSources: createSearchSourcesTool({
      question: options.question,
      queryCount,
      sources: options.sources,
      onCandidates: (candidates) => {
        candidateUrls.clear()
        for (const candidate of candidates) candidateUrls.add(candidate.url)
      },
      onSearchResults: options.onSearchResults,
    }),
    fetchSources: createFetchSourcesTool({ initialFetches, extraFetches, sources: options.sources, candidateUrls }),
  }
}
