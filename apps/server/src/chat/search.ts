import { fatwaSearch } from "@sirathic/core/tools/fatwaSearch";
import { fiqhSearch } from "@sirathic/core/tools/fiqhSearch";
import { hadithSearch } from "@sirathic/core/tools/hadithSearch";
import { newsSearch } from "@sirathic/core/tools/newsSearch";
import { quranSearch } from "@sirathic/core/tools/quranSearch";
import { webFetch } from "@sirathic/core/tools/webFetch";
import { webSearch } from "@sirathic/core/tools/webSearch";
import { hostOf, isOnSite } from "@sirathic/core/web/url";
import { z } from "zod";
import { reasonOf } from "../http";
import type { Source } from "../shared/sources";
import {
  type Cite,
  clip,
  fatwaSource,
  fiqhSource,
  gradeOf,
  type Hit,
  hadithSource,
  hadithTitle,
  hitSource,
  numbered,
  plainText,
  textBlocked,
  type Verse,
  verseSource,
} from "./cite";
import { bestPieces, fiqhBlock, hadithBlock, pagesBlock, pageText, quranBlock } from "./compact";
import { cleanSearch } from "./searchQuery";

const RESULT_CHARS = 2_000;
const QUESTION_CHARS = 400;
const TAFSIR_CHARS = 500;
const FATWA_CHARS = 1_500;

const SEARCH_SOURCES = ["quran", "hadith", "fatwa", "fiqh", "web", "news"] as const;

type SearchSource = (typeof SEARCH_SOURCES)[number];

const TIMES = ["pastWeek", "pastMonth", "pastYear"] as const;

const SEARCH_LIMITS = {
  quran: 2,
  hadith: 3,
  fatwa: 5,
  fiqh: 2,
  web: 5,
  news: 8,
} satisfies Record<SearchSource, number>;

const ISLAMIC_SOURCES: ReadonlySet<SearchSource> = new Set(["quran", "hadith", "fatwa", "fiqh"]);
const WEB_BESIDE_ISLAMIC = 4;
const LISTED_PER_QUERY = 10;

export const searchInput = z.object({
  queries: z
    .array(z.string().trim().min(2).max(120))
    .min(1)
    .max(3)
    .describe(
      'Short keyword queries, at most 3, covering what matters most to the answer instead of every detail. Preferred: ["zakat on gold jewelry"]. Not: ["Do I have to pay zakat on my gold jewelry?"]',
    ),
  arabic: z
    .array(z.string().trim().min(2).max(120))
    .max(2)
    .optional()
    .describe(
      "Arabic keyword queries for the fiqh books and Arabic fatwa sites, in the exact terms the classical books use for the issue, not modern phrasing",
    ),
  sources: z
    .array(z.enum(SEARCH_SOURCES))
    .min(1)
    .describe(
      "quran for verses and their tafsir, hadith for hadith and their grades, fatwa for rulings from scholars and fatwa sites, fiqh for the classical books (use it with arabic queries when the schools may differ), web for history, comparisons and everything outside Islamic questions, news for current events",
    ),
  sites: z
    .array(z.string().trim().max(100))
    .max(5)
    .optional()
    .describe(
      'Domains to limit web and fatwa results to, such as ["islamqa.info"]. Use it when the user names a site.',
    ),
  time: z
    .enum(TIMES)
    .optional()
    .describe("Only web and news results from the past week, month or year"),
});

type TafsirGroup = Awaited<ReturnType<typeof quranSearch>>["tafsirEn"][number];
type Time = z.infer<typeof searchInput>["time"];
type Searched = { results: unknown[]; sources: Source[]; text: string };

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

function interleave<Item>(lists: Item[][], keyOf: (item: Item) => string, limit: number) {
  const seen = new Set<string>();
  const merged: Item[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest && merged.length < limit; index++) {
    for (const list of lists) {
      const item = list[index];
      if (item === undefined || seen.has(keyOf(item))) continue;
      seen.add(keyOf(item));
      merged.push(item);
      if (merged.length === limit) break;
    }
  }
  return merged;
}

const tafsirFor = (groups: TafsirGroup[], verse: Verse) =>
  groups.find((group) => {
    const [surah, range = ""] = group.verses.split(":");
    const [from, to = from] = range.split("-").map(Number);
    return (
      Number(surah) === verse.surah &&
      from !== undefined &&
      verse.ayah >= from &&
      verse.ayah <= (to ?? from)
    );
  })?.text;

const searchQuran = async (cite: Cite, queries: string[]) => {
  const found = await Promise.all(
    queries.map((query) => quranSearch({ query, limit: LISTED_PER_QUERY })),
  );
  const ranked = interleave(
    found.map((result) => result.verses),
    (verse) => String(verse.id),
    Number.POSITIVE_INFINITY,
  );
  const tafsir = found.flatMap((result) => result.tafsirEn);
  const { cited, sources } = numbered(cite, ranked.slice(0, SEARCH_LIMITS.quran), verseSource);
  const results = cited.map((verse) => ({
    citation: verse.citation,
    ref: `Quran ${verse.surah}:${verse.ayah} (${verse.surahName})`,
    arabic: verse.textAr,
    english: verse.textEn,
    tafsir: clip(tafsirFor(tafsir, verse), TAFSIR_CHARS),
  }));
  return {
    sources: [...sources, ...ranked.slice(SEARCH_LIMITS.quran).map(verseSource)],
    results,
    text: quranBlock(results),
  };
};

const searchHadith = async (cite: Cite, queries: string[]) => {
  const found = await Promise.all(
    queries.map((query) => hadithSearch({ query, limit: LISTED_PER_QUERY })),
  );
  const ranked = interleave(
    found.map((result) => result.hadiths),
    (hadith) => hadith.id,
    Number.POSITIVE_INFINITY,
  );
  const { cited, sources } = numbered(cite, ranked.slice(0, SEARCH_LIMITS.hadith), hadithSource);
  const results = cited.map((hadith) => ({
    citation: hadith.citation,
    ref: hadithTitle(hadith),
    english: clip(hadith.english, 450),
    arabic: clip(hadith.textAr, hadith.english ? 180 : 350),
    grade: gradeOf(hadith),
  }));
  return {
    sources: [
      ...sources,
      ...ranked.slice(SEARCH_LIMITS.hadith).flatMap((hadith) => hadithSource(hadith) ?? []),
    ],
    results,
    text: hadithBlock(
      cited.map((hadith) => ({
        citation: hadith.citation,
        ref: hadithTitle(hadith),
        english: clip(hadith.english, RESULT_CHARS),
        arabic: hadith.textAr,
        grade: gradeOf(hadith),
      })),
    ),
  };
};

const FIQH_SCHOOLS = [
  ["hanafi", SEARCH_LIMITS.fiqh],
  ["maliki", SEARCH_LIMITS.fiqh],
  ["shafii", SEARCH_LIMITS.fiqh],
  ["hanbali", SEARCH_LIMITS.fiqh],
  ["comparative", 1],
] as const;

const searchFiqh = async (cite: Cite, queries: string[], sites: string[]) => {
  const bySchool = await Promise.all(
    FIQH_SCHOOLS.map(async ([school, limit]) =>
      interleave(
        (await Promise.all(queries.map((query) => fiqhSearch({ query, school, limit })))).map(
          (result) => result.passages,
        ),
        (passage) => passage.id,
        limit,
      ),
    ),
  );
  const onSites = bySchool
    .flat()
    .filter(
      ({ url }) =>
        sites.length === 0 || (url !== null && sites.some((site) => isOnSite(hostOf(url), site))),
    );
  const { cited, sources } = numbered(cite, onSites, fiqhSource);
  const results = cited.map((passage) => ({
    citation: passage.citation,
    work: passage.work,
    author: passage.author,
    school: passage.school,
    volume: passage.volume,
    page: passage.page,
    heading: passage.heading,
    text: clip(passage.textAr, RESULT_CHARS),
  }));
  return { sources, results, text: fiqhBlock(results) };
};

const readPages = async (hits: Hit[], queries: readonly string[]) => {
  const read = await Promise.all(
    hits.map((hit) =>
      webFetch({ url: hit.url }).then(
        (page) =>
          bestPieces(pageText(page.markdown, Number.POSITIVE_INFINITY), queries, RESULT_CHARS),
        () => undefined,
      ),
    ),
  );
  return new Map(
    hits.flatMap((hit, index) => {
      const text = read[index];
      return text ? [[hit.url, text]] : [];
    }),
  );
};

const citedPages = (
  cite: Cite,
  hits: Hit[],
  passages: Map<string, string>,
  dates?: Map<string, string>,
) => {
  const { cited, sources } = numbered(cite, hits, hitSource);
  return {
    sources,
    results: cited.map((hit) => ({
      citation: hit.citation,
      title: hit.title,
      site: siteOf(hit.url),
      date: dates?.get(hit.url) ?? null,
      text: passages.get(hit.url) ?? plainText(hit.description),
    })),
  };
};

const searchFatwa = async (cite: Cite, queries: string[], arabic: string[], sites: string[]) => {
  const found = await Promise.all(
    [...queries, ...arabic].map((query) => fatwaSearch({ query, sites, limit: LISTED_PER_QUERY })),
  );
  const ranked = interleave(
    found.map((result) => result.fatwas),
    (fatwa) => fatwa.url,
    Number.POSITIVE_INFINITY,
  );
  const { cited, sources } = numbered(cite, ranked.slice(0, SEARCH_LIMITS.fatwa), fatwaSource);
  const results = cited.map((fatwa) => {
    const head = pageText(
      [
        fatwa.question && `Question: ${clip(fatwa.question, QUESTION_CHARS)}`,
        fatwa.summary && `Summary: ${fatwa.summary}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      FATWA_CHARS,
    );
    const room = FATWA_CHARS - head.length - 2;
    return {
      citation: fatwa.citation,
      title: fatwa.title,
      site: [siteOf(fatwa.url), fatwa.answeredBy, fatwa.school].filter(Boolean).join(", "),
      date: fatwa.publishedAt?.toISOString().slice(0, 10) ?? null,
      text: [
        head,
        room > 0 &&
          bestPieces(
            pageText(fatwa.answer, Number.POSITIVE_INFINITY),
            [...queries, ...arabic],
            room,
          ),
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  });
  return {
    sources: [...sources, ...ranked.slice(SEARCH_LIMITS.fatwa).map(fatwaSource)],
    results,
    text: pagesBlock("fatwa", results),
  };
};

const unlessAllFail = async <Value>(runs: Promise<Value>[]) => {
  const settled = await Promise.allSettled(runs);
  const done = settled.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));
  const failed = settled.find((run) => run.status === "rejected");
  if (done.length === 0 && failed) throw failed.reason;
  return done;
};

const searchWeb = async (
  cite: Cite,
  queries: string[],
  sites: string[],
  time: Time,
  limit: number,
) => {
  const found = await unlessAllFail(
    queries.map((query) => webSearch({ query, sites, time, limit: LISTED_PER_QUERY })),
  );
  const hits = interleave(
    found.map((list) => list.filter((hit) => !textBlocked(hit.url))),
    (hit) => hit.url,
    Number.POSITIVE_INFINITY,
  ).map((hit) => ({
    url: hit.url,
    title: hit.title,
    description: hit.description ?? "",
  }));
  const read = hits.slice(0, limit);
  const pages = citedPages(cite, read, await readPages(read, queries));
  return {
    ...pages,
    sources: [...pages.sources, ...hits.slice(limit).map(hitSource)],
    text: pagesBlock("web", pages.results),
  };
};

const searchNews = async (cite: Cite, queries: string[], time: Time) => {
  const found = await unlessAllFail(
    queries.map((query) =>
      newsSearch({ query, time, limit: SEARCH_LIMITS.news }).then((result) => result.articles),
    ),
  );
  const articles = interleave(
    found.map((list) => list.filter((article) => !textBlocked(article.url))),
    (article) => article.url,
    SEARCH_LIMITS.news,
  );
  const dates = new Map(
    articles.flatMap((article) =>
      article.publishedAt ? [[article.url, article.publishedAt]] : [],
    ),
  );
  const hits = articles.map((article) => ({
    url: article.url,
    title: article.title,
    description: article.description ?? "",
  }));
  const pages = citedPages(cite, hits, await readPages(hits, queries), dates);
  return { ...pages, text: pagesBlock("news", pages.results) };
};

export const searchAll = async (cite: Cite, input: z.infer<typeof searchInput>) => {
  const { queries, arabic, sites, notes } = cleanSearch({
    queries: input.queries,
    arabic: input.arabic ?? [],
    sites: input.sites ?? [],
  });
  if (queries.length === 0 && arabic.length === 0) {
    return { results: {}, sources: [], text: `Nothing was searched. ${notes.join(" ")}` };
  }
  const { time } = input;
  const chosen = [...new Set(input.sources)];
  const webPages = chosen.some((name) => ISLAMIC_SOURCES.has(name))
    ? WEB_BESIDE_ISLAMIC
    : SEARCH_LIMITS.web;
  const runs = {
    quran: () => searchQuran(cite, queries),
    hadith: () => searchHadith(cite, [...queries, ...arabic]),
    fatwa: () => searchFatwa(cite, queries, arabic, sites),
    fiqh: () => searchFiqh(cite, arabic.length > 0 ? arabic : queries, sites),
    web: () => searchWeb(cite, queries, sites, time, webPages),
    news: () => searchNews(cite, queries, time),
  } satisfies Record<SearchSource, () => Promise<Searched>>;
  const done = await Promise.all(
    chosen.map(async (name) => {
      const found = await runs[name]().then(
        (searched) => ({ ...searched, failed: false }),
        (err: Error) => {
          console.warn(`search ${name} failed: ${reasonOf(err)}`);
          return { results: [], sources: [], text: "", failed: true };
        },
      );
      return { name, found };
    }),
  );
  const failed = done.filter(({ found }) => found.failed).map(({ name }) => name);
  return {
    results: Object.fromEntries(done.map(({ name, found }) => [name, found.results])),
    sources: done.flatMap(({ found }) => found.sources),
    text: [
      ...done.map(({ found }) => found.text),
      failed.length > 0
        ? `Search failed for ${failed.join(", ")}. Those results are missing, not empty.`
        : "",
      ...notes,
    ]
      .filter((text) => text)
      .join("\n\n"),
  };
};
