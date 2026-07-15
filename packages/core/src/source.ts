import type { RawSource, Source, WebHit } from "./types"

const MAX_SOURCES = 5
const MAX_SOURCE_CHARS = 4_000

function sourceIdentity(url: string) {
  const parsed = new URL(url)
  const domain = parsed.hostname.replace(/^www\./, "")
  return { domain, faviconUrl: `${parsed.origin}/favicon.ico` }
}

export function webToSource(hit: WebHit): RawSource {
  const label = hit.title && hit.title !== hit.url ? `${hit.source} — ${hit.title}` : hit.source
  return {
    kind: hit.kind ?? "web",
    label,
    url: hit.url,
    tier: hit.tier,
    role: hit.role,
    text: hit.text,
    ...sourceIdentity(hit.url),
    ...(hit.faviconUrl ? { faviconUrl: hit.faviconUrl } : {}),
  }
}

export function numberSources(raw: RawSource[]): Source[] {
  const seen = new Set<string>()
  const sources: Source[] = []
  for (const source of raw) {
    const key = `${source.url}|${source.lang ?? ""}`
    if (seen.has(key) || !source.text.trim()) continue
    seen.add(key)
    sources.push({
      ...source,
      index: sources.length + 1,
      text: source.text.replace(/[ \t]+/g, " ").trim().slice(0, MAX_SOURCE_CHARS),
    })
    if (sources.length >= MAX_SOURCES) break
  }
  return sources
}

export function formatSources(sources: Source[]): string {
  return sources
    .map((s) => `[${s.index}] ${s.label} (${s.url})${s.role ? `\nSource role: ${s.role}` : ""}\n${s.text}`)
    .join("\n\n")
}
