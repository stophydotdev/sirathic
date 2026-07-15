import { createHash } from "node:crypto"
import TurndownService from "turndown"
import { fail } from "./result"
import type { FetchOptions, FetchResult } from "../../types"

const DIRECT_TIMEOUT_MS = 3_000
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const DEFAULT_UA = "sirathic-bot/0.1 (+https://sirathic.com)"

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function fetchDirect(opts: FetchOptions, fetcher: Fetcher = fetch): Promise<FetchResult> {
  const timeoutMs = Math.min(opts.timeoutMs ?? DIRECT_TIMEOUT_MS, DIRECT_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetcher(opts.url, {
      headers: {
        Accept: "text/html, text/plain;q=0.9",
        "User-Agent": opts.userAgent ?? DEFAULT_UA,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "direct fetch failed"
    const timedOut = /timeout|aborted/i.test(message)
    return fail(opts.url, timedOut ? "timeout" : "transport", { message })
  }

  if (!response.ok) {
    return fail(opts.url, "http-error", { status: response.status, message: response.statusText })
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!/text\/(?:html|plain)/i.test(contentType)) {
    return fail(opts.url, "no-markdown", { message: `unsupported content type: ${contentType || "unknown"}` })
  }

  const html = await response.text()
  const htmlBytes = new TextEncoder().encode(html).byteLength
  if (htmlBytes > (opts.maxBytes ?? DEFAULT_MAX_BYTES)) {
    return fail(opts.url, "too-large", { message: `response ${htmlBytes} bytes exceeds limit` })
  }
  if (looksBlocked(html)) return fail(opts.url, "http-error", { status: 403, message: "direct fetch detected an anti-bot page" })

  const turndown = new TurndownService({ bulletListMarker: "-", headingStyle: "atx" })
  turndown.remove(["script", "style", "noscript", "nav", "footer", "aside", "form"])
  const markdown = turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim()
  if (markdown.length < 200 || !/[\p{L}]{20}/u.test(markdown.replace(/\s+/g, ""))) {
    return fail(opts.url, "no-markdown", { message: "direct fetch returned too little readable text" })
  }

  const bytes = new TextEncoder().encode(markdown)
  const titleHtml = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? opts.url
  const title = turndown.turndown(titleHtml).replace(/\s+/g, " ").trim() || opts.url
  const lang = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1] ?? null

  return {
    ok: true,
    url: opts.url,
    finalUrl: response.url || opts.url,
    status: response.status,
    title,
    lang,
    markdown,
    metadata: {},
    links: null,
    media: null,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
    truncated: false,
    fetchedAt: new Date().toISOString(),
    via: "direct",
    crawlMode: "direct",
  }
}

function looksBlocked(html: string): boolean {
  const text = html.slice(0, 10_000).toLowerCase()
  return [
    "attention required! | cloudflare",
    "cf-chl-captcha",
    "checking your browser before accessing",
    "<title>just a moment...</title>",
    "please verify you are a human",
  ].some((marker) => text.includes(marker))
}
