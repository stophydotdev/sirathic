import { createHash } from "node:crypto"
import { env } from "@sirathic/env/server"
import { asNumber, asString, isRecord, parseJson } from "./internal"
import { fail } from "./result"
import type { Crawl4AIResult, EngineMode, FetchOptions, FetchResult, MarkdownVariant } from "../../types"

const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const DEFAULT_UA = "sirathic-bot/0.1 (+https://sirathic.com)"

export async function crawl(opts: FetchOptions, mode: EngineMode): Promise<FetchResult> {
  const baseUrl = (opts.crawl4aiUrl ?? env.CRAWL4AI_URL).replace(/\/$/, "")
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  let res: Response
  try {
    res = await fetch(`${baseUrl}/crawl`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(timeoutMs + 5_000),
      body: JSON.stringify(buildBody(opts, mode, timeoutMs)),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "crawl4ai request failed"
    const lowered = message.toLowerCase()
    const timedOut = lowered.includes("timeout") || lowered.includes("aborted")
    return fail(opts.url, timedOut ? "timeout" : "transport", { message })
  }

  const body = await res.text()
  if (!res.ok) {
    return fail(opts.url, "http-error", { status: res.status, message: body.slice(0, 1_000) || res.statusText })
  }

  const result = firstResult(parseJson(body))
  if (!result) return fail(opts.url, "transport", { message: "crawl4ai returned no result" })

  if (result.success === false) {
    const status = asNumber(result.status_code) ?? asNumber(result.status)
    return fail(opts.url, status ? "http-error" : "transport", {
      ...(status ? { status } : {}),
      message: asString(result.error_message) ?? "crawl4ai crawl failed",
    })
  }

  const markdown = pickMarkdown(result.markdown, opts.markdownVariant ?? "fit")
  if (!markdown.trim()) return fail(opts.url, "no-markdown", { message: "crawl4ai returned empty markdown" })
  if (looksLikeBlockPage(markdown)) {
    return fail(opts.url, "http-error", { status: 403, message: "crawl4ai detected an anti-bot challenge page" })
  }

  const bytes = new TextEncoder().encode(markdown)
  if (bytes.byteLength > maxBytes) {
    return fail(opts.url, "too-large", { message: `markdown ${bytes.byteLength} > maxBytes ${maxBytes}` })
  }

  const metadata = isRecord(result.metadata) ? result.metadata : {}

  return {
    ok: true,
    url: opts.url,
    finalUrl: asString(result.final_url) ?? asString(result.redirected_url) ?? asString(result.url) ?? opts.url,
    status: asNumber(result.status_code) ?? asNumber(result.status) ?? null,
    title: asString(metadata.title) ?? asString(metadata.ogTitle) ?? opts.url,
    lang: asString(metadata.language) ?? asString(metadata.lang) ?? null,
    markdown,
    metadata,
    links: isRecord(result.links) ? result.links : null,
    media: isRecord(result.media) ? result.media : null,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    truncated: false,
    fetchedAt: new Date().toISOString(),
    via: "crawl4ai",
    crawlMode: mode,
  }
}

function buildBody(opts: FetchOptions, mode: EngineMode, timeoutMs: number) {
  const browserParams: Record<string, unknown> = {
    headless: true,
    user_agent: opts.userAgent ?? DEFAULT_UA,
    java_script_enabled: mode === "browser",
    text_mode: true,
    light_mode: true,
    avoid_ads: true,
    avoid_css: true,
    accept_downloads: false,
    memory_saving_mode: true,
    ...opts.browserConfig,
  }

  const crawlerParams: Record<string, unknown> = {
    stream: false,
    cache_mode: "bypass",
    check_robots_txt: true,
    page_timeout: timeoutMs,
    wait_until: "domcontentloaded",
    wait_for_images: false,
    only_text: true,
    excluded_tags: ["script", "style", "noscript", "svg", "canvas", "nav", "footer", "aside", "form"],
    remove_forms: true,
    exclude_external_images: true,
    exclude_all_images: true,
    exclude_external_links: true,
    exclude_social_media_links: true,
    process_iframes: false,
    scan_full_page: false,
    screenshot: false,
    pdf: false,
    capture_mhtml: false,
    ...opts.crawlerConfig,
  }

  return {
    urls: [opts.url],
    browser_config: { type: "BrowserConfig", params: browserParams },
    crawler_config: { type: "CrawlerRunConfig", params: crawlerParams },
  }
}

function looksLikeBlockPage(markdown: string): boolean {
  if (markdown.length > 2_000) return false
  const text = markdown.toLowerCase()
  return [
    "attention required! | cloudflare",
    "cf-chl-captcha",
    "checking your browser before accessing",
    "just a moment...",
    "please verify you are a human",
    "request unsuccessful. incapsula incident id",
  ].some((marker) => text.includes(marker))
}

function firstResult(payload: unknown): Crawl4AIResult | undefined {
  if (!isRecord(payload)) return undefined
  const candidate = Array.isArray(payload.results) ? payload.results[0] : payload.result ?? payload
  return isRecord(candidate) ? candidate : undefined
}

function pickMarkdown(value: unknown, variant: MarkdownVariant): string {
  if (typeof value === "string") return value
  if (!isRecord(value)) return ""

  const order =
    variant === "fit"
      ? ["fit_markdown", "raw_markdown", "markdown_with_citations"]
      : variant === "citations"
        ? ["markdown_with_citations", "fit_markdown", "raw_markdown"]
        : ["raw_markdown", "fit_markdown", "markdown_with_citations"]

  for (const key of order) {
    const text = asString(value[key])
    if (text) return text
  }
  return ""
}
