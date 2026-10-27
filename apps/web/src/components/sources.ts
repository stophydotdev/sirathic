import type { ThreadMessage } from "@assistant-ui/react";
import { createContext } from "react";
import { z } from "zod";
import { type Source, source } from "@sirathic/server/sources";
import { researchOf } from "@/components/research";
import type { MessageKey } from "@/messages/en";

const sourced = z.object({ sources: z.array(source) });
const CITED_LINK = /\[\d+\]\((https?:\/\/[^)\s]+)\)/gu;

const textOf = (content: ThreadMessage["content"]) =>
  content.map((part) => (part.type === "text" ? part.text : "")).join("");

const citedUrlsOf = (content: ThreadMessage["content"]) => [
  ...new Set(
    [...textOf(content).matchAll(CITED_LINK)].flatMap((match) => (match[1] ? [match[1]] : [])),
  ),
];

export function sourcesOf(content: ThreadMessage["content"]) {
  const found = new Map<string, Source>();
  for (const part of content) {
    if (part.type !== "tool-call") continue;
    for (const entry of sourced.safeParse(part.result).data?.sources ?? []) {
      if (!found.has(entry.url)) found.set(entry.url, entry);
    }
  }
  const cited = citedUrlsOf(content);
  const rank = (url: string) => (cited.includes(url) ? cited.indexOf(url) : cited.length);
  return [...found.values()].toSorted((a, b) => rank(a.url) - rank(b.url));
}

export function turnsOf(messages: readonly ThreadMessage[]) {
  return messages.flatMap((message, i) => {
    if (message.role !== "user") return [];
    const reply = messages[i + 1];
    const content = reply?.role === "assistant" ? reply.content : [];
    return [
      {
        id: message.id,
        question: textOf(message.content),
        queries: [
          ...new Set(
            researchOf(content, false).flatMap((step) =>
              step.kind === "searches" ? step.queries : [],
            ),
          ),
        ],
        sources: sourcesOf(content),
      },
    ];
  });
}

export const SourcesContext = createContext<ReadonlyMap<string, Source>>(new Map());

const SOURCE_KINDS = ["quran", "hadith", "fatwa", "book", "web"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

const SITES = new Map(
  Object.entries({
    "quran.com": { name: "Quran.com", kind: "quran" },
    "sunnah.com": { name: "Sunnah.com", kind: "hadith" },
    "ar.wikisource.org": { name: "Wikisource", kind: "hadith" },
    "shamela.ws": { name: "Shamela", kind: "book" },
    "aboutislam.net": { name: "About Islam", kind: "fatwa" },
    "akramnadwi.com": { name: "Akram Nadwi", kind: "fatwa" },
    "al-fatawa.com": { name: "Al-Fatawa", kind: "fatwa" },
    "albalagh.net": { name: "Albalagh", kind: "fatwa" },
    "almadina.org": { name: "Al-Madina Institute", kind: "fatwa" },
    "amjaonline.org": { name: "AMJA", kind: "fatwa" },
    "basiraeducation.org": { name: "Basira Education", kind: "fatwa" },
    "blog.zoya.finance": { name: "Zoya", kind: "fatwa" },
    "britishfatwacouncil.org": { name: "British Fatwa Council", kind: "fatwa" },
    "dar-alifta.org": { name: "Dar al-Ifta (Egypt)", kind: "fatwa" },
    "daruliftaa.us": { name: "Darul Iftaa USA", kind: "fatwa" },
    "diftalon.com": { name: "Diftalon", kind: "fatwa" },
    "drhatemalhaj.com": { name: "Dr. Hatem al-Haj", kind: "fatwa" },
    "en.tohed.com": { name: "Tohed", kind: "fatwa" },
    "fatwaislam.com": { name: "Fatwa Islam", kind: "fatwa" },
    "fiqh.islamonline.net": { name: "IslamOnline Fiqh", kind: "fatwa" },
    "fiqhcouncil.org": { name: "Fiqh Council of North America", kind: "fatwa" },
    "hadithoftheday.com": { name: "Hadith of the Day", kind: "fatwa" },
    "herislamicfinance.com": { name: "Her Islamic Finance", kind: "fatwa" },
    "iifa-aifi.org": { name: "International Islamic Fiqh Academy", kind: "fatwa" },
    "islamicfinanceguru.com": { name: "Islamic Finance Guru", kind: "fatwa" },
    "islamicorigins.com": { name: "Islamic Origins", kind: "fatwa" },
    "islamonline.net": { name: "IslamOnline", kind: "fatwa" },
    "islamqa.info": { name: "IslamQA", kind: "fatwa" },
    "islamqa.org": { name: "IslamQA.org", kind: "fatwa" },
    "islamweb.net": { name: "IslamWeb", kind: "fatwa" },
    "mathabah.org": { name: "Mathabah", kind: "fatwa" },
    "muftiwp.gov.my": { name: "Mufti of Wilayah Persekutuan", kind: "fatwa" },
    "muslimheritage.com": { name: "Muslim Heritage", kind: "fatwa" },
    "muslimmatters.org": { name: "MuslimMatters", kind: "fatwa" },
    "productivemuslim.com": { name: "ProductiveMuslim", kind: "fatwa" },
    "qalaminstitute.org": { name: "Qalam Institute", kind: "fatwa" },
    "renovatio.zaytuna.edu": { name: "Renovatio", kind: "fatwa" },
    "sandala.org": { name: "Sandala", kind: "fatwa" },
    "sapienceinstitute.org": { name: "Sapience Institute", kind: "fatwa" },
    "seekersguidance.org": { name: "SeekersGuidance", kind: "fatwa" },
    "thehumblei.com": { name: "The Humble I", kind: "fatwa" },
    "virtualmosque.com": { name: "Virtual Mosque", kind: "fatwa" },
    "yaqeeninstitute.org": { name: "Yaqeen Institute", kind: "fatwa" },
  } satisfies Record<string, { name: string; kind: SourceKind }>),
);

const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "");

export function siteName(url: string) {
  const host = hostOf(url);
  if (!host) return url;
  return SITES.get(host)?.name ?? (host.split(".").slice(0, -1).join(".") || host);
}

const kindOf = (url: string): SourceKind => SITES.get(hostOf(url) ?? "")?.kind ?? "web";

export const KIND_NAMES = {
  quran: "Quran",
  hadith: "Hadith",
  fatwa: "Fatwas",
  book: "Books",
  web: "Web",
} satisfies Record<SourceKind, MessageKey>;

export const groupsOf = (sources: readonly Source[]) =>
  SOURCE_KINDS.map((kind) => ({
    kind,
    sources: sources.filter((found) => kindOf(found.url) === kind),
  })).filter((group) => group.sources.length > 0);

export const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(URL.parse(url)?.hostname ?? url)}`;
