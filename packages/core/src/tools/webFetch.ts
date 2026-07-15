import { crawl } from "./webFetch/crawl4ai"
import { fetchDirect } from "./webFetch/direct"
import { fail } from "./webFetch/result"
import { tool } from "ai"
import { z } from "zod"
import { classifyDomain } from "./sourceRegistry"
import { cacheKey, cached } from "../cache"
import type { FetchFailure, FetchOptions, FetchResult, ResearchSource } from "../types"

const MAX_FETCH_CHARS = 6_000
const DAY = 24 * 60 * 60

export async function fetchUrl(opts: FetchOptions): Promise<FetchResult> {
  const canonicalUrl = canonicalizeUrl(opts.url)
  const key = cacheKey("fetch", {
    crawl4aiUrl: opts.crawl4aiUrl,
    fetchStrategy: "direct-v1",
    markdownVariant: opts.markdownVariant ?? "fit",
    mode: opts.crawlMode ?? "auto",
    url: canonicalUrl,
  })

  return cached(key, fetchCacheTtl(canonicalUrl), () => fetchUrlUncached(opts), (result) => result.ok)
}

async function fetchUrlUncached(opts: FetchOptions): Promise<FetchResult> {
  if (!isValidUrl(opts.url)) return fail(opts.url, "invalid-url", { message: "invalid url" })

  const mode = opts.crawlMode ?? "auto"
  if (mode !== "auto") return crawl(opts, mode)

  const direct = await fetchDirect(opts)
  if (direct.ok || !shouldEscalate(direct)) return direct

  const text = await crawl(opts, "static")
  if (text.ok || !shouldEscalate(text)) return text
  return crawl(opts, "browser")
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ""
    const removableKeys = Array.from(url.searchParams.keys()).filter(
      (key) => key.startsWith("utm_") || key === "ref" || key === "source",
    )
    for (const key of removableKeys) url.searchParams.delete(key)
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "")
    return url.toString()
  } catch {
    return value
  }
}

export function fetchCacheTtl(url: string): number {
  const source = classifyDomain(url)
  let domain = ""
  try {
    domain = new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return DAY
  }

  if (domain === "quran.com" || domain.endsWith(".quran.com") || domain === "sunnah.com" || domain.endsWith(".sunnah.com")) {
    return 30 * DAY
  }
  if (source?.role === "fatwa") return 7 * DAY
  if (source?.tier === "A" || source?.tier === "B") return 3 * DAY
  return DAY
}

export function shouldEscalate(result: FetchFailure): boolean {
  if (result.reason === "no-markdown" || result.reason === "timeout" || result.reason === "transport") return true
  if (result.reason !== "http-error") return false
  return result.status === 403 || result.status === 408 || result.status === 429 || Boolean(result.status && result.status >= 500)
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function sourceKind(domain: string): ResearchSource {
  if (domain === "quran.com" || domain.endsWith(".quran.com")) return "quran"
  if (domain === "sunnah.com" || domain.endsWith(".sunnah.com") || domain === "muwatta.com") return "hadith"
  return "web"
}

export function createFetchSourcesTool(options: {
  initialFetches: number
  extraFetches: number
  sources?: ResearchSource[]
  candidateUrls?: Set<string>
}) {
  const enabled = new Set(options.sources ?? ["quran", "hadith", "web"])
  const fetched = new Set<string>()
  let batchNumber = 0

  return tool({
    description: `Fetch the ${options.initialFetches} most accurate, authoritative, and diverse candidate URLs in one call. Prefer primary sources and avoid selecting three pages from the same domain. A later call may fetch up to ${options.extraFetches} additional URLs only when evidence is missing, conflicting, or a fetch failed.`,
    inputSchema: z.object({
      urls: z.array(z.string().url()).min(1).max(options.initialFetches).describe(`Top ${options.initialFetches} candidate URLs`),
    }),
    execute: async ({ urls }) => {
      const limit = batchNumber === 0 ? options.initialFetches : options.extraFetches
      batchNumber += 1
      const allowed = options.candidateUrls
        ? new Set([...options.candidateUrls].map(canonicalizeUrl))
        : undefined
      const selected = [...new Set(urls)]
        .filter((url) => !fetched.has(canonicalizeUrl(url)) && (!allowed || allowed.has(canonicalizeUrl(url))))
        .slice(0, limit)
      selected.forEach((url) => fetched.add(canonicalizeUrl(url)))

      return Promise.all(
        selected.map(async (url) => {
          const source = classifyDomain(url)
          if (!source?.citable) {
            return { ok: false as const, url, error: "source is not citable or allowlisted" }
          }

          const parsed = new URL(url)
          const domain = parsed.hostname.replace(/^www\./, "")
          const kind = sourceKind(domain)
          if (!enabled.has(kind)) return { ok: false as const, url, error: `${kind} sources are disabled` }

          const response = await fetchUrl({ url })
          if (!response.ok) {
            return { ok: false as const, url, error: `${response.reason}${response.message ? `: ${response.message}` : ""}` }
          }

          return {
            ok: true as const,
            url: response.finalUrl,
            title: response.title,
            domain,
            faviconUrl: `${parsed.origin}/favicon.ico`,
            kind,
            tier: source.tier,
            role: source.role,
            source: source.name,
            markdown: response.markdown.slice(0, MAX_FETCH_CHARS),
            truncated: response.markdown.length > MAX_FETCH_CHARS,
          }
        }),
      )
    },
  })
}
