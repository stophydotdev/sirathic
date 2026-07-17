import { createHash } from "node:crypto"
import { env } from "@sirathic/env/server"
import type { FetchOptions, FetchResult } from "../../types"
import { fail } from "./result"

const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function scrapeFirecrawl(opts: FetchOptions, fetcher: Fetcher = fetch): Promise<FetchResult> {
  const baseUrl = (opts.firecrawlUrl ?? env.FIRECRAWL_URL).replace(/\/$/, "")
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": opts.userAgent ?? "sirathic/firecrawl",
  }
  const apiKey = opts.firecrawlApiKey ?? env.FIRECRAWL_API_KEY
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  let response: Response
  try {
    response = await fetcher(`${baseUrl}/v2/scrape`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: opts.url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: timeoutMs,
        removeBase64Images: true,
        blockAds: true,
      }),
      signal: AbortSignal.timeout(timeoutMs + 1_000),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firecrawl request failed"
    return fail(opts.url, /timeout|aborted/i.test(message) ? "timeout" : "transport", { message })
  }

  const text = await response.text()
  if (!response.ok) {
    return fail(opts.url, "http-error", { status: response.status, message: firecrawlError(text, response.statusText) })
  }

  const payload = parseRecord(text)
  const data = recordValue(payload?.data)
  if (payload?.success !== true || !data) {
    return fail(opts.url, "transport", { message: firecrawlError(text, "Firecrawl returned an unsuccessful response") })
  }

  const markdown = stringValue(data.markdown)?.trim() ?? ""
  if (!markdown) return fail(opts.url, "no-markdown", { message: "Firecrawl returned no markdown" })

  const bytes = new TextEncoder().encode(markdown)
  if (bytes.byteLength > (opts.maxBytes ?? DEFAULT_MAX_BYTES)) {
    return fail(opts.url, "too-large", { message: `response ${bytes.byteLength} bytes exceeds limit` })
  }

  const metadata = recordValue(data.metadata) ?? {}
  const finalUrl = stringValue(metadata.sourceURL) ?? stringValue(metadata.url) ?? opts.url
  const status = numberValue(metadata.statusCode)
  const links = Array.isArray(data.links)
    ? { items: data.links.filter((value): value is string => typeof value === "string") }
    : null

  return {
    ok: true,
    url: opts.url,
    finalUrl,
    status,
    title: stringValue(metadata.title) ?? finalUrl,
    lang: stringValue(metadata.language) ?? null,
    markdown,
    metadata,
    links,
    media: null,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    truncated: false,
    fetchedAt: new Date().toISOString(),
    via: "firecrawl",
  }
}

function parseRecord(text: string): Record<string, unknown> | undefined {
  try {
    return recordValue(JSON.parse(text) as unknown)
  } catch {
    return undefined
  }
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

function firecrawlError(text: string, fallback: string): string {
  const payload = parseRecord(text)
  return stringValue(payload?.error) ?? fallback
}
