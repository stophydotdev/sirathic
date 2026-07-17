import type {
  AllowlistResult,
  Classified,
  Madhhab,
  SourceDomain,
  SourceRole,
  SourceTier,
  SourceTopic,
} from "../types"

type SourceOptions = {
  madhhab?: Madhhab
  allowedPaths?: string[]
  allowedPathPatterns?: string[]
  excludedPaths?: string[]
  topics?: SourceTopic[]
  priority?: number
  immutable?: boolean
}

function source(
  domain: string,
  name: string,
  tier: SourceTier,
  role: SourceRole,
  citable: boolean,
  options: SourceOptions = {},
): SourceDomain {
  return { domain, name, tier, role, citable, madhhab: options.madhhab ?? "cross", ...options }
}

const primary = (domain: string, name: string, options: SourceOptions = {}) =>
  source(domain, name, "A", "primary", true, { ...options, immutable: true })
const fatwa = (domain: string, name: string, options: SourceOptions = {}) =>
  source(domain, name, "B", "fatwa", true, options)
const guidance = (domain: string, name: string, options: SourceOptions = {}) =>
  source(domain, name, "B", "guidance", true, options)
const counseling = (domain: string, name: string, options: SourceOptions = {}) =>
  source(domain, name, "B", "counseling", true, options)
const discovery = (domain: string, name: string, options: SourceOptions = {}) =>
  source(domain, name, "C", "discovery", false, options)

export const registry: SourceDomain[] = [
  primary("quran.com", "Quran.com"),
  primary("sunnah.com", "Sunnah.com"),
  primary("muwatta.com", "Muwatta"),

  fatwa("dar-alifta.org", "Egypt's Dar Al-Ifta", {
    allowedPaths: ["/en/fatwa/details/"],
    topics: ["daily-life", "family", "finance", "relationships", "work", "worship"],
  }),
  fatwa("aliftaa.jo", "Jordan General Iftaa Department", {
    allowedPaths: ["/en-fatwas/"],
    topics: ["daily-life", "family", "finance", "relationships", "work", "worship"],
  }),
  fatwa("muftiwp.gov.my", "Mufti of the Federal Territory", {
    madhhab: "shafii",
    allowedPaths: ["/en/artikel/al-kafi-li-al-fatawi/"],
    topics: ["daily-life", "family", "finance", "work", "worship"],
  }),

  fatwa("aboutislam.net", "AboutIslam — Ask the Scholar", {
    allowedPaths: ["/counseling/ask-the-scholar/", "/live-session/ask-the-scholar", "/live-session/have-a-question-ask-the-scholar"],
    topics: ["daily-life", "family", "finance", "relationships", "spirituality", "work", "worship"],
  }),
  counseling("aboutislam.net", "AboutIslam — Ask the Counselor", {
    allowedPaths: ["/counseling/ask-the-counselor/", "/live-session/ask-the-counselor"],
    topics: ["daily-life", "family", "mental-health", "relationships", "spirituality"],
  }),
  discovery("aboutislam.net", "AboutIslam"),

  guidance("productivemuslim.com", "Productive Muslim", {
    excludedPaths: ["/", "/topics", "/component-previews/articles-section"],
    topics: ["daily-life", "family", "habits", "productivity", "relationships", "spirituality", "work"],
  }),

  fatwa("islamqa.info", "IslamQA (al-Munajjid)", {
    allowedPathPatterns: ["^/[a-z]{2}(?:-[a-z]{2})?/answers/\\d+(?:/|$)"],
    priority: 12,
    topics: ["daily-life", "family", "finance", "relationships", "spirituality", "work", "worship"],
  }),
  discovery("islamqa.info", "IslamQA"),
  fatwa("islamweb.net", "IslamWeb Fatwas", {
    allowedPathPatterns: ["^/en/fatwa/\\d+(?:/|$)"],
    priority: 9,
    topics: ["daily-life", "family", "finance", "relationships", "spirituality", "work", "worship"],
  }),
  discovery("islamweb.net", "IslamWeb"),
  fatwa("seekersguidance.org", "SeekersGuidance Answers", {
    allowedPathPatterns: ["^/answers/[^/]+/[^/]+(?:/|$)"],
    priority: 8,
    topics: ["daily-life", "family", "relationships", "spirituality", "work", "worship"],
  }),
  discovery("seekersguidance.org", "SeekersGuidance"),
  fatwa("islamqa.org", "IslamQA.org — Multi-madhhab Answers", {
    allowedPathPatterns: ["^/(?:hanafi|shafii|maliki|hanbali)/[^/]+/\\d+(?:/|$)"],
    priority: 8,
    topics: ["daily-life", "family", "finance", "relationships", "spirituality", "work", "worship"],
  }),
  discovery("islamqa.org", "IslamQA.org"),
  fatwa("askimam.org", "Ask Imam (Darul Iftaa)", { madhhab: "hanafi" }),
  fatwa("muftisays.com", "MuftiSays", { madhhab: "hanafi" }),
  fatwa("aqfatwa.com", "Darul Iftaa (AQ Fatwa)", { madhhab: "hanafi" }),
  fatwa("fatwaqa.com", "FatwaQA", { madhhab: "hanafi" }),
  guidance("dorar.net", "Dorar (al-Durar al-Saniyya)"),

  guidance("authenticmaliki.com", "Authentic Maliki", { madhhab: "maliki" }),
  fatwa("malikifiqhqa.com", "Maliki Fiqh QA", { madhhab: "maliki" }),
  guidance("malikischool.org", "Maliki School", { madhhab: "maliki" }),
  guidance("imammalikschool.org", "Imam Malik School", { madhhab: "maliki" }),

  guidance("al-islam.org", "Al-Islam.org", { madhhab: "shia" }),
  fatwa("sistani.org", "Sistani.org", { madhhab: "shia" }),
  fatwa("imam-us.org", "Imam Mahdi Association", { madhhab: "shia" }),

  guidance("yaqeeninstitute.org", "Yaqeen Institute", {
    topics: ["daily-life", "family", "mental-health", "relationships", "spirituality"],
  }),
  guidance("rahmahinstitute.com", "Rahmah Institute", { topics: ["family", "relationships", "spirituality"] }),
  guidance("ihsaninstitute.co.uk", "Ihsan Institute", { topics: ["spirituality"] }),

  discovery("reddit.com", "Reddit"),
  discovery("quora.com", "Quora"),
  discovery("facebook.com", "Facebook"),
  discovery("youtube.com", "YouTube"),
  discovery("instagram.com", "Instagram"),
  discovery("shiachat.com", "ShiaChat", { madhhab: "shia" }),
]

export function isRegisteredSourceDomain(domain: string): boolean {
  const host = domain.toLowerCase().replace(/^www\./, "")
  return registry.some((entry) => host === entry.domain || host.endsWith(`.${entry.domain}`))
}

function normalizedPath(pathname: string): string {
  if (pathname === "/") return pathname
  return pathname.replace(/\/+$/, "")
}

function matchesPath(entry: SourceDomain, pathname: string): boolean {
  const path = normalizedPath(pathname)
  if (entry.excludedPaths?.some((excluded) => path === normalizedPath(excluded))) return false
  const hasPathRules = Boolean(entry.allowedPaths?.length || entry.allowedPathPatterns?.length)
  if (!hasPathRules) return true

  const matchesPrefix = entry.allowedPaths?.some((allowed) => path.startsWith(normalizedPath(allowed))) ?? false
  const matchesPattern = entry.allowedPathPatterns?.some((pattern) => new RegExp(pattern, "i").test(path)) ?? false
  return matchesPrefix || matchesPattern
}

export function classifyDomain(url: string): SourceDomain | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  let host = parsed.hostname.toLowerCase()
  if (host.startsWith("www.")) host = host.slice(4)

  for (const entry of registry) {
    const matchesDomain = host === entry.domain || host.endsWith(`.${entry.domain}`)
    if (matchesDomain && matchesPath(entry, parsed.pathname)) return entry
  }
  return undefined
}

export function filterToAllowlist<T extends { url: string }>(items: T[]): AllowlistResult<T> {
  const citable: Classified<T>[] = []
  const leads: Classified<T>[] = []
  const rejected: T[] = []

  for (const item of items) {
    const sourceEntry = classifyDomain(item.url)
    if (!sourceEntry) rejected.push(item)
    else if (!sourceEntry.citable) leads.push({ ...item, source: sourceEntry })
    else citable.push({ ...item, source: sourceEntry })
  }

  return { citable, leads, rejected }
}
