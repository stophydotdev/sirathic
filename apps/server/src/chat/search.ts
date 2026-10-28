import { duaSearch } from "@sirathic/core/tools/duaSearch";
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
import {
  bestPieces,
  duaBlock,
  fiqhBlock,
  hadithBlock,
  pagesBlock,
  pageText,
  quranBlock,
} from "./compact";
import { nearFused, withinChars } from "./cut";
import { fuse } from "./fuse";
import { relevant } from "./relevance";
import { cleanSearch } from "./searchQuery";

const RESULT_CHARS = 500;
const WEB_CHARS = 2_000;
const QUESTION_CHARS = 300;
const TAFSIR_CHARS = 1_500;
const TAFSIR_VERSES = 2;
const HEAD_CHARS = 300;
const FATWA_CHARS = 900;

const SEARCH_SOURCES = ["quran", "hadith", "fatwa", "fiqh", "web", "news", "duas"] as const;

type SearchSource = (typeof SEARCH_SOURCES)[number];

const TIMES = ["pastWeek", "pastMonth", "pastYear"] as const;

const SEARCH_LIMITS = {
  quran: 6,
  web: 8,
  news: 8,
  duas: 5,
} satisfies Partial<Record<SearchSource, number>>;

const LISTED_PER_QUERY = 20;
const POOL_PER_SOURCE = 20;
const FIQH_PER_SCHOOL = 4;
const TOTAL_CHARS = 24_000;
const BUDGETED = new Set<SearchSource>(["hadith", "fatwa", "fiqh"]);
const WEB_LISTED_PER_QUERY = 10;
const WEB_READ_PER_QUERY = 5;

export const searchInput = z.object({
  queries: z
    .array(z.string().trim().min(2).max(120))
    .min(1)
    .max(3)
    .describe(
      "An array of keyword-based search queries. Each query should be short, as longer queries may reduce performance. Provide at most 3 queries, prioritizing the questions most important to the answer instead of decomposing every part.",
    ),
  arabic: z
    .array(z.string().trim().min(2).max(120))
    .max(3)
    .optional()
    .describe(
      "Arabic keyword queries for the fiqh books and Arabic fatwa sites, in the exact terms the classical books use for the issue, not modern phrasing",
    ),
  sources: z
    .array(z.enum(SEARCH_SOURCES))
    .min(1)
    .describe(
      "quran for verses and their tafsir, hadith for hadith and their grades, fatwa for rulings from scholars and fatwa sites, fiqh for the classical books (use it with arabic queries when the schools may differ), web for history, comparisons and everything outside Islamic questions, news for current events, duas for duas and adhkar for an occasion or need",
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
  const ranked = fuse(
    found.map((result) => result.verses),
    (verse) => String(verse.id),
  );
  const tafsir = found.flatMap((result) => result.tafsirEn);
  const { kept, dropped } = await relevant(
    queries.join("; "),
    ranked.slice(0, SEARCH_LIMITS.quran),
    (verse) => `Quran ${verse.surah}:${verse.ayah}\n${clip(verse.textEn, HEAD_CHARS)}`,
  );
  const { cited, sources } = numbered(cite, kept, verseSource);
  const results = cited.map((verse, index) => ({
    citation: verse.citation,
    ref: `Quran ${verse.surah}:${verse.ayah} (${verse.surahName})`,
    arabic: verse.textAr,
    english: verse.textEn,
    tafsir: index < TAFSIR_VERSES ? clip(tafsirFor(tafsir, verse), TAFSIR_CHARS) : "",
  }));
  return {
    sources: [...sources, ...[...dropped, ...ranked.slice(SEARCH_LIMITS.quran)].map(verseSource)],
    results,
    text: quranBlock(results),
  };
};

const searchHadith = async (cite: Cite, queries: string[], chars: number) => {
  const found = await Promise.all(
    queries.map((query) => hadithSearch({ query, limit: LISTED_PER_QUERY })),
  );
  const { near, far } = nearFused(
    found.map((result) => result.hadiths),
    (hadith) => hadith.id,
  );
  const { kept, dropped } = await relevant(
    queries.join("; "),
    near.slice(0, POOL_PER_SOURCE),
    (hadith) => `${hadithTitle(hadith)}\n${clip(hadith.english, HEAD_CHARS)}`,
  );
  const { fits, over } = withinChars(
    kept,
    (hadith) =>
      Math.min(hadith.english?.length ?? 0, RESULT_CHARS) +
      Math.min(hadith.textAr?.length ?? 0, RESULT_CHARS),
    chars,
  );
  const { cited, sources } = numbered(cite, fits, hadithSource);
  const results = cited.map((hadith) => ({
    citation: hadith.citation,
    ref: hadithTitle(hadith),
    english: clip(hadith.english, RESULT_CHARS),
    arabic: clip(hadith.textAr, RESULT_CHARS),
    grade: gradeOf(hadith),
  }));
  return {
    sources: [
      ...sources,
      ...[...dropped, ...over, ...near.slice(POOL_PER_SOURCE), ...far].flatMap(
        (hadith) => hadithSource(hadith) ?? [],
      ),
    ],
    results,
    text: hadithBlock(results),
  };
};

const searchDuas = async (queries: string[]) => {
  const found = await Promise.all(
    queries.map((query) => duaSearch({ query, limit: SEARCH_LIMITS.duas })),
  );
  const duas = fuse(
    found.map((result) => result.duas),
    (dua) => dua.id,
  ).slice(0, SEARCH_LIMITS.duas);
  return { results: duas, sources: [], text: duaBlock(duas) };
};

const FIQH_SCHOOLS = ["hanafi", "maliki", "shafii", "hanbali", "comparative"] as const;

type FiqhHit = Awaited<ReturnType<typeof fiqhSearch>>["passages"][number];

export const onePerPage = (passages: readonly FiqhHit[]) => {
  const pages = new Map<string, { first: FiqhHit; texts: string[] }>();
  for (const passage of passages) {
    const key = passage.url ?? passage.id;
    const texts = pages.get(key)?.texts ?? [];
    if (texts.length === 0) pages.set(key, { first: passage, texts });
    texts.push(clip(passage.textAr, RESULT_CHARS) ?? "");
  }
  return [...pages.values()].map(({ first, texts }) =>
    Object.assign(first, { textAr: texts.join("\n") }),
  );
};

const searchFiqh = async (cite: Cite, queries: string[], sites: string[], chars: number) => {
  const bySchool = await Promise.all(
    queries.map((query) =>
      Promise.all(
        FIQH_SCHOOLS.map(
          async (school) => (await fiqhSearch({ query, school, limit: FIQH_PER_SCHOOL })).passages,
        ),
      ),
    ),
  );
  const bestOfSchool = new Set(
    bySchool.flatMap((lists) => lists.flatMap((list) => list.slice(0, 1))),
  );
  const { near, far } = nearFused(
    bySchool.map((lists) => lists.flat().toSorted((a, b) => a.distance - b.distance)),
    (passage) => passage.id,
    (passage) => bestOfSchool.has(passage),
  );
  const pool = near.filter(
    (passage, index) =>
      index < POOL_PER_SOURCE ||
      !near.slice(0, index).some(({ school }) => school === passage.school),
  );
  const onSites = onePerPage(
    pool.filter(
      ({ url }) =>
        sites.length === 0 || (url !== null && sites.some((site) => isOnSite(hostOf(url), site))),
    ),
  );
  const { kept, dropped } = await relevant(
    queries.join("; "),
    onSites,
    (passage) =>
      `${passage.work} (${passage.school})${passage.heading ? `: ${passage.heading}` : ""}\n${clip(passage.textAr, HEAD_CHARS)}`,
  );
  const { fits, over } = withinChars(kept, (passage) => passage.textAr.length, chars);
  const { cited, sources } = numbered(cite, fits, fiqhSource);
  const results = cited.map((passage) => ({
    citation: passage.citation,
    work: passage.work,
    author: passage.author,
    school: passage.school,
    volume: passage.volume,
    page: passage.page,
    heading: passage.heading,
    text: passage.textAr,
  }));
  return {
    sources: [
      ...sources,
      ...[
        ...dropped,
        ...over,
        ...near.filter((passage) => !pool.includes(passage)),
        ...far,
      ].flatMap((passage) => fiqhSource(passage) ?? []),
    ],
    results,
    text: fiqhBlock(results),
  };
};

const extract = (markdown: string, queries: readonly string[]) =>
  bestPieces(pageText(markdown, Number.POSITIVE_INFINITY), queries, WEB_CHARS);

const readPages = async (hits: Hit[], queries: readonly string[]) => {
  const read = await Promise.all(
    hits.map((hit) =>
      webFetch({ url: hit.url }).then(
        (page) => extract(page.markdown, queries),
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

const searchFatwa = async (cite: Cite, queries: string[], sites: string[], chars: number) => {
  const found = await Promise.all(
    queries.map((query) => fatwaSearch({ query, sites, limit: LISTED_PER_QUERY })),
  );
  const { near, far } = nearFused(
    found.map((result) => result.fatwas),
    (fatwa) => fatwa.url,
  );
  const { kept, dropped } = await relevant(
    queries.join("; "),
    near.slice(0, POOL_PER_SOURCE),
    (fatwa) => `${fatwa.title}\n${clip(fatwa.question ?? fatwa.summary, HEAD_CHARS)}`,
  );
  const { fits, over } = withinChars(
    kept,
    (fatwa) =>
      Math.min(
        FATWA_CHARS,
        Math.min(fatwa.question?.length ?? 0, QUESTION_CHARS) +
          (fatwa.summary?.length ?? 0) +
          fatwa.answer.length,
      ),
    chars,
  );
  const { cited, sources } = numbered(cite, fits, fatwaSource);
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
        room > 0 && bestPieces(pageText(fatwa.answer, Number.POSITIVE_INFINITY), queries, room),
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  });
  return {
    sources: [
      ...sources,
      ...[...dropped, ...over, ...near.slice(POOL_PER_SOURCE), ...far].map(fatwaSource),
    ],
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

const searchWeb = async (cite: Cite, queries: string[], sites: string[], time: Time) => {
  const found = await unlessAllFail(
    queries.map((query) =>
      webSearch({
        query,
        sites,
        time,
        limit: WEB_LISTED_PER_QUERY,
        read: Math.min(WEB_READ_PER_QUERY, Math.ceil(SEARCH_LIMITS.web / queries.length)),
      }),
    ),
  );
  const scraped = new Map(
    found.flat().flatMap((hit) => (hit.markdown ? [[hit.url, hit.markdown]] : [])),
  );
  const hits = fuse(
    found.map((list) => list.filter((hit) => !textBlocked(hit.url))),
    (hit) => hit.url,
  ).map((hit) => ({
    url: hit.url,
    title: hit.title,
    description: hit.description ?? "",
  }));
  const read = hits.slice(0, SEARCH_LIMITS.web);
  const fetched = await readPages(
    read.filter((hit) => !scraped.has(hit.url)),
    queries,
  );
  const passages = new Map([
    ...read.flatMap((hit) => {
      const markdown = scraped.get(hit.url);
      return markdown ? [[hit.url, extract(markdown, queries)] as const] : [];
    }),
    ...fetched,
  ]);
  const { kept, dropped } = await relevant(
    queries.join("; "),
    read,
    (hit) => `${hit.title}\n${clip(passages.get(hit.url) ?? hit.description, HEAD_CHARS)}`,
  );
  const pages = citedPages(cite, kept, passages);
  return {
    ...pages,
    sources: [...pages.sources, ...[...dropped, ...hits.slice(SEARCH_LIMITS.web)].map(hitSource)],
    text: pagesBlock("web", pages.results),
  };
};

const searchNews = async (cite: Cite, queries: string[], time: Time) => {
  const found = await unlessAllFail(
    queries.map((query) =>
      newsSearch({ query, time, limit: SEARCH_LIMITS.news }).then((result) => result.articles),
    ),
  );
  const articles = fuse(
    found.map((list) => list.filter((article) => !textBlocked(article.url))),
    (article) => article.url,
  ).slice(0, SEARCH_LIMITS.news);
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
  const both = [...new Set([...queries, ...arabic])];
  const share = Math.floor(
    TOTAL_CHARS / Math.max(1, chosen.filter((name) => BUDGETED.has(name)).length),
  );
  const runs = {
    quran: () => searchQuran(cite, queries),
    hadith: () => searchHadith(cite, both, share),
    fatwa: () => searchFatwa(cite, both, sites, share),
    fiqh: () => searchFiqh(cite, arabic.length > 0 ? arabic : queries, sites, share),
    web: () => searchWeb(cite, queries, sites, time),
    news: () => searchNews(cite, queries, time),
    duas: () => searchDuas(both),
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
