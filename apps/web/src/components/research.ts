import type { ThreadMessage } from "@assistant-ui/react";
import { z } from "zod";

type Part = ThreadMessage["content"][number];

const SEARCH_SOURCES = ["quran", "hadith", "fiqh", "fatwa", "web", "news"] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

const searchArgs = z
  .object({ queries: z.array(z.string()), arabic: z.array(z.string()) })
  .partial();

const page = z.object({ title: z.string(), url: z.string() });
const searchOutput = z.object({
  results: z
    .object({
      quran: z.array(z.object({ ref: z.string() })).catch([]),
      hadith: z.array(z.object({ ref: z.string(), grade: z.string().nullable() })).catch([]),
      fiqh: z.array(z.object({ work: z.string(), school: z.string() })).catch([]),
      fatwa: z.array(z.object({ title: z.string(), site: z.string() })).catch([]),
      web: z.array(page).catch([]),
      news: z.array(page).catch([]),
    })
    .partial(),
  sources: z.array(page).catch([]),
});

const quranArgs = z.object({
  surah: z.number(),
  from: z.number().optional(),
  to: z.number().optional(),
});
const urlArgs = z.object({ url: z.string() });
const queryArgs = z.object({ query: z.string() });
const LEGACY_SEARCHES = new Set([
  "quranSearch",
  "hadithSearch",
  "fiqhSearch",
  "fatwaSearch",
  "webSearch",
  "newsSearch",
]);

export type Read = { source: SearchSource; title: string; detail?: string; url?: string };

export type ResearchStep =
  | { kind: "think"; text: string; live: boolean }
  | { kind: "searches"; queries: string[]; results: Read[]; done: boolean }
  | { kind: "browse"; url: string }
  | { kind: "verses"; title: string; url: string }
  | { kind: "tool"; tool: string; detail: string };

const hostOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const VERSE_REF = /Quran (\d+):(\d+)/u;

const sentencesOf = (text: string) =>
  text
    .replaceAll(/[*#`]/gu, "")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const WORD_COUNT = /\bword count\b|\d\s*words\b/iu;

const PROGRESS_PREFIX =
  /^(?:now\s+|next\s+|[^,]{0,40},\s+)?I(?:['’]m| am)\s+(?:also\s+|now\s+|still\s+)?(?=\w+ing\b)/iu;

const headlineOf = (paragraph: string) => {
  const sentence = sentencesOf(paragraph).find((line) => !/^the user\b/iu.test(line)) ?? "";
  const [clause = ""] = sentence
    .replace(PROGRESS_PREFIX, "")
    .replaceAll(/\s*\[\d+\]/gu, "")
    .split(/[:;(\u2014]| - |, (?=\w+ing\b|which\b|where\b|while\b|since\b|plus\b|so\b)/u);
  const headline = capitalized(clause.trim().replace(/[.,]$/u, ""));
  return /^\w+ing\b/u.test(headline) && !WORD_COUNT.test(headline) ? headline : "";
};

const thoughtOf = (text: string, live: boolean) => {
  const paragraphs = text.split(/\n\s*\n/u).filter((paragraph) => paragraph.trim());
  const finished = live ? paragraphs.slice(0, -1) : paragraphs;
  return finished.map(headlineOf).findLast(Boolean) ?? "";
};

function readsOf({ results, sources }: z.infer<typeof searchOutput>): Read[] {
  const linkOf = (title: string) =>
    sources.find((found) => found.title === title || found.title.startsWith(`${title}:`))?.url;
  return [
    ...(results.quran ?? []).map(({ ref }): Read => {
      const [, surah, ayah] = VERSE_REF.exec(ref) ?? [];
      return {
        source: "quran",
        title: ref,
        url: surah ? `https://quran.com/${surah}/${ayah}` : undefined,
      };
    }),
    ...(results.hadith ?? []).map(({ ref, grade }): Read => ({
      source: "hadith",
      title: ref,
      detail: grade?.split(" (")[0],
      url: linkOf(ref),
    })),
    ...(results.fiqh ?? []).map(({ work, school }): Read => ({
      source: "fiqh",
      title: work,
      detail: capitalized(school),
    })),
    ...(results.fatwa ?? []).map(({ title, site }): Read => ({
      source: "fatwa",
      title,
      detail: site.split(", ")[0],
      url: linkOf(title),
    })),
    ...(results.web ?? []).map(({ title, url }): Read => ({
      source: "web",
      title,
      detail: hostOf(url),
      url,
    })),
    ...(results.news ?? []).map(({ title, url }): Read => ({
      source: "news",
      title,
      detail: hostOf(url),
      url,
    })),
  ];
}

export function researchOf(parts: readonly Part[], thinkingLive: boolean) {
  const steps: ResearchStep[] = [];
  parts.forEach((part, i) => {
    if (part.type === "reasoning") {
      const live = thinkingLive && i === parts.length - 1;
      const text = thoughtOf(part.text, live);
      if (live || text) steps.push({ kind: "think", text, live });
      return;
    }
    if (part.type !== "tool-call") return;
    if (part.toolName === "search" || LEGACY_SEARCHES.has(part.toolName)) {
      const { queries = [], arabic = [] } = searchArgs.safeParse(part.args).data ?? {};
      const legacy = queryArgs.safeParse(part.args).data?.query;
      const asked = legacy ? [legacy] : [...queries, ...arabic];
      const output = searchOutput.safeParse(part.result).data;
      const found = output ? readsOf(output) : [];
      const done = part.result !== undefined;
      const batch = steps.at(-1);
      if (batch?.kind === "searches") {
        batch.queries.push(...asked);
        batch.results.push(...found);
        batch.done &&= done;
      } else if (asked.length > 0) {
        steps.push({ kind: "searches", queries: asked, results: found, done });
      }
      return;
    }
    if (part.toolName === "webFetch") {
      const url = urlArgs.safeParse(part.args).data?.url;
      if (url) steps.push({ kind: "browse", url });
      return;
    }
    if (part.toolName === "quranGet") {
      const verses = quranArgs.safeParse(part.args).data;
      if (!verses) return;
      const from = verses.from ?? 1;
      const range = verses.to && verses.to !== from ? `${from}-${verses.to}` : `${from}`;
      steps.push({
        kind: "verses",
        title: `Quran ${verses.surah}:${range}`,
        url: `https://quran.com/${verses.surah}/${from}`,
      });
      return;
    }
    steps.push({
      kind: "tool",
      tool: part.toolName,
      detail: queryArgs.safeParse(part.args).data?.query ?? "",
    });
  });
  return steps;
}
