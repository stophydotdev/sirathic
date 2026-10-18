import { calculator, calculatorInput } from "@sirathic/core/tools/calculator";
import {
  currencyConvert,
  currencyConvertInput,
} from "@sirathic/core/tools/currencyConvert";
import { duaSearch, duaSearchInput } from "@sirathic/core/tools/duaSearch";
import {
  fidyaKaffarah,
  fidyaKaffarahInput,
} from "@sirathic/core/tools/fidyaKaffarah";
import { fiqhGet, fiqhGetInput } from "@sirathic/core/tools/fiqhGet";
import { fatwaSearch } from "@sirathic/core/tools/fatwaSearch";
import { fiqhSearch } from "@sirathic/core/tools/fiqhSearch";
import { geocode, geocodeInput } from "@sirathic/core/tools/geocode";
import {
  hadithCheck,
  hadithCheckInput,
} from "@sirathic/core/tools/hadithCheck";
import { hadithGet, hadithGetInput } from "@sirathic/core/tools/hadithGet";
import { hadithSearch } from "@sirathic/core/tools/hadithSearch";
import {
  halalStockScreen,
  halalStockScreenInput,
} from "@sirathic/core/tools/halalStockScreen";
import { hijriDate, hijriDateInput } from "@sirathic/core/tools/hijriDate";
import {
  inheritance,
  inheritanceInput,
} from "@sirathic/core/tools/inheritance";
import {
  islamicCalendar,
  islamicCalendarInput,
} from "@sirathic/core/tools/islamicCalendar";
import {
  islamicUnits,
  islamicUnitsInput,
} from "@sirathic/core/tools/islamicUnits";
import {
  namedReference,
  namedReferenceInput,
} from "@sirathic/core/tools/namedReference";
import {
  namesOfAllah,
  namesOfAllahInput,
} from "@sirathic/core/tools/namesOfAllah";
import {
  flightSearch,
  flightSearchInput,
} from "@sirathic/core/tools/flightSearch";
import {
  hotelSearch,
  hotelSearchInput,
} from "@sirathic/core/tools/hotelSearch";
import {
  mapsReviews,
  mapsReviewsInput,
} from "@sirathic/core/tools/mapsReviews";
import { mapsSearch, mapsSearchInput } from "@sirathic/core/tools/mapsSearch";
import { newsSearch } from "@sirathic/core/tools/newsSearch";
import { placesNear, placesNearInput } from "@sirathic/core/tools/placesNear";
import {
  prayerTimes,
  prayerTimesInput,
} from "@sirathic/core/tools/prayerTimes";
import { qibla, qiblaInput } from "@sirathic/core/tools/qibla";
import { quranGet, quranGetInput } from "@sirathic/core/tools/quranGet";
import {
  redditSearch,
  redditSearchInput,
} from "@sirathic/core/tools/redditSearch";
import {
  redditThread,
  redditThreadInput,
} from "@sirathic/core/tools/redditThread";
import { quranSearch } from "@sirathic/core/tools/quranSearch";
import { weather, weatherInput } from "@sirathic/core/tools/weather";
import { webFetch, webFetchInput } from "@sirathic/core/tools/webFetch";
import { webSearch } from "@sirathic/core/tools/webSearch";
import {
  youtubeSearch,
  youtubeSearchInput,
} from "@sirathic/core/tools/youtubeSearch";
import {
  youtubeTranscript,
  youtubeTranscriptInput,
} from "@sirathic/core/tools/youtubeTranscript";
import {
  zakatAlFitr,
  zakatAlFitrInput,
} from "@sirathic/core/tools/zakatAlFitr";
import {
  zakatCalculator,
  zakatCalculatorInput,
} from "@sirathic/core/tools/zakatCalculator";
import { tool } from "ai";
import { z } from "zod";
import { reasonOf } from "../respond";
import type { Source } from "../shared/sources";
import {
  fiqhBlock,
  hadithBlock,
  pagesBlock,
  pageText,
  quranBlock,
} from "./compact";

const SNIPPET_CHARS = 300;
const PAGE_CHARS = 8_000;
const RESULT_CHARS = 2_000;
const QUESTION_CHARS = 400;
const TAFSIR_CHARS = 500;
const FATWA_CHARS = 1_500;

export type Cite = (url: string) => number;
type Verse = Awaited<ReturnType<typeof quranSearch>>["verses"][number];
type Hadith = Awaited<ReturnType<typeof hadithSearch>>["hadiths"][number];
type Fatwa = Awaited<ReturnType<typeof fatwaSearch>>["fatwas"][number];
type FiqhPassage = Awaited<ReturnType<typeof fiqhSearch>>["passages"][number];
type Hit = { url: string; title: string; description: string };

const verseSource = (verse: Verse): Source => ({
  url: `https://quran.com/${verse.surah}/${verse.ayah}`,
  title: `Quran ${verse.surah}:${verse.ayah}, ${verse.surahName}`,
  snippet: verse.textEn.slice(0, SNIPPET_CHARS),
});

const COLLECTIONS = new Map([
  ["bukhari", "Sahih al-Bukhari"],
  ["muslim", "Sahih Muslim"],
  ["nasai", "Sunan an-Nasa'i"],
  ["abudawud", "Sunan Abi Dawud"],
  ["ibnmajah", "Sunan Ibn Majah"],
  ["tirmidhi", "Jami' at-Tirmidhi"],
  ["malik", "Muwatta Malik"],
  ["ahmad", "Musnad Ahmad"],
  ["darimi", "Sunan ad-Darimi"],
  ["riyadussalihin", "Riyad as-Salihin"],
  ["adab", "Al-Adab al-Mufrad"],
  ["nawawi", "40 Hadith an-Nawawi"],
  ["qudsi", "40 Hadith Qudsi"],
  ["dehlawi", "40 Hadith of Shah Waliullah Dehlawi"],
]);

const hadithTitle = (hadith: Hadith) => {
  const number =
    hadith.book === "ahmad" && hadith.arabicNumber
      ? hadith.arabicNumber
      : hadith.id.slice(hadith.id.indexOf(":") + 1);
  const name = `${COLLECTIONS.get(hadith.book) ?? hadith.book} ${number}`;
  return hadith.chapter ? `${name}: ${hadith.chapter}` : name;
};

const MACHINE_TRANSLATION =
  "Machine translation from the Arabic. Check it before you quote it.";

const hadithSource = (hadith: Hadith): Source | undefined =>
  hadith.link === null
    ? undefined
    : {
        url: hadith.link,
        title: hadithTitle(hadith),
        snippet: (hadith.english ?? hadith.textAr ?? "").slice(
          0,
          SNIPPET_CHARS,
        ),
        credit:
          hadith.english !== null && hadith.licensedEnglish === null
            ? [hadith.credit, MACHINE_TRANSLATION]
                .filter((line) => line !== null)
                .join(". ")
            : (hadith.credit ?? undefined),
      };

const fiqhSource = (passage: FiqhPassage): Source | undefined =>
  passage.url === null
    ? undefined
    : {
        url: passage.url,
        title: `${passage.work}، ${passage.author}، ج${passage.volume} ص${passage.page}`,
        snippet: passage.textAr.slice(0, SNIPPET_CHARS),
      };

const plainText = (markdown: string) =>
  markdown
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replaceAll(/[#*_`>|]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, SNIPPET_CHARS);

const hitSource = (hit: Hit): Source => ({
  url: hit.url,
  title: hit.title,
  snippet: plainText(hit.description),
});

function numbered<Item>(
  cite: Cite,
  items: Item[],
  sourceOf: (item: Item) => Source | undefined,
) {
  const sources: Source[] = [];
  const cited = items.map((item) => {
    const found = sourceOf(item);
    if (found === undefined) return { ...item, citation: null };
    sources.push(found);
    return { ...item, citation: cite(found.url) };
  });
  return { cited, sources };
}

const SEARCH_SOURCES = [
  "quran",
  "hadith",
  "fatwa",
  "fiqh",
  "web",
  "news",
] as const;

type SearchSource = (typeof SEARCH_SOURCES)[number];

const SEARCH_LIMITS = {
  quran: 2,
  hadith: 3,
  fatwa: 5,
  fiqh: 2,
  web: 5,
  news: 8,
} satisfies Record<SearchSource, number>;

const ISLAMIC_SOURCES: ReadonlySet<SearchSource> = new Set([
  "quran",
  "hadith",
  "fatwa",
  "fiqh",
]);
const WEB_BESIDE_ISLAMIC = 4;
const LISTED_PER_QUERY = 10;

const searchInput = z.object({
  queries: z
    .array(z.string().trim().min(2).max(120))
    .min(1)
    .max(3)
    .describe("1 to 3 keyword queries, each from a different angle"),
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
      "quran, hadith, fatwa and fiqh for Islamic questions; web or news for everything else",
    ),
});

type TafsirGroup = Awaited<ReturnType<typeof quranSearch>>["tafsirEn"][number];
type Searched = { results: unknown[]; sources: Source[]; text: string };

const textBlocked = (url: string) =>
  /(^|\.)sunnah\.com$/u.test(URL.parse(url)?.hostname ?? "");

const clip = (text: string | null | undefined, chars: number) => {
  const plain = text?.replaceAll(/\s+/gu, " ").trim();
  if (!plain) return null;
  return plain.length > chars ? `${plain.slice(0, chars)}…` : plain;
};

const siteOf = (url: string) =>
  URL.parse(url)?.hostname.replace(/^www\./u, "") ?? url;

function interleave<Item>(
  lists: Item[][],
  keyOf: (item: Item) => string,
  limit: number,
) {
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

const gradeOf = (hadith: Hadith) => {
  if (hadith.grades.length > 0) {
    return clip(
      hadith.grades
        .map(({ grader, grade }) => `${grade} (${grader})`)
        .join("; "),
      140,
    );
  }
  return hadith.book === "bukhari" || hadith.book === "muslim"
    ? `Sahih (${COLLECTIONS.get(hadith.book)})`
    : null;
};

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
  const { cited, sources } = numbered(
    cite,
    ranked.slice(0, SEARCH_LIMITS.quran),
    verseSource,
  );
  const results = cited.map((verse) => ({
    citation: verse.citation,
    ref: `Quran ${verse.surah}:${verse.ayah} (${verse.surahName})`,
    arabic: verse.textAr,
    english: verse.textEn,
    tafsir: clip(tafsirFor(tafsir, verse), TAFSIR_CHARS),
  }));
  return {
    sources: [
      ...sources,
      ...ranked.slice(SEARCH_LIMITS.quran).map(verseSource),
    ],
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
  const { cited, sources } = numbered(
    cite,
    ranked.slice(0, SEARCH_LIMITS.hadith),
    hadithSource,
  );
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
      ...ranked
        .slice(SEARCH_LIMITS.hadith)
        .flatMap((hadith) => hadithSource(hadith) ?? []),
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

const searchFiqh = async (cite: Cite, queries: string[]) => {
  const bySchool = await Promise.all(
    FIQH_SCHOOLS.map(async ([school, limit]) =>
      interleave(
        (
          await Promise.all(
            queries.map((query) => fiqhSearch({ query, school, limit })),
          )
        ).map((result) => result.passages),
        (passage) => passage.id,
        limit,
      ),
    ),
  );
  const { cited, sources } = numbered(cite, bySchool.flat(), fiqhSource);
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

const readPages = async (hits: Hit[]) => {
  const read = await Promise.all(
    hits.map((hit) =>
      webFetch({ url: hit.url }).then(
        (page) => pageText(page.markdown, RESULT_CHARS),
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

const fatwaSource = (fatwa: Fatwa): Source => ({
  url: fatwa.url,
  title: fatwa.title,
  snippet: plainText(fatwa.summary ?? fatwa.question ?? fatwa.answer),
});

const searchFatwa = async (cite: Cite, queries: string[], arabic: string[]) => {
  const found = await Promise.all(
    [...queries, ...arabic].map((query) =>
      fatwaSearch({ query, limit: LISTED_PER_QUERY }),
    ),
  );
  const ranked = interleave(
    found.map((result) => result.fatwas),
    (fatwa) => fatwa.url,
    Number.POSITIVE_INFINITY,
  );
  const { cited, sources } = numbered(
    cite,
    ranked.slice(0, SEARCH_LIMITS.fatwa),
    fatwaSource,
  );
  const results = cited.map((fatwa) => ({
    citation: fatwa.citation,
    title: fatwa.title,
    site: [siteOf(fatwa.url), fatwa.answeredBy, fatwa.school]
      .filter(Boolean)
      .join(", "),
    date: fatwa.publishedAt?.toISOString().slice(0, 10) ?? null,
    text: pageText(
      [
        fatwa.question && `Question: ${clip(fatwa.question, QUESTION_CHARS)}`,
        fatwa.summary && `Summary: ${fatwa.summary}`,
        fatwa.answer,
      ]
        .filter(Boolean)
        .join("\n\n"),
      FATWA_CHARS,
    ),
  }));
  return {
    sources: [
      ...sources,
      ...ranked.slice(SEARCH_LIMITS.fatwa).map(fatwaSource),
    ],
    results,
    text: pagesBlock("fatwa", results),
  };
};

const searchWeb = async (cite: Cite, queries: string[], limit: number) => {
  const found = await Promise.all(
    queries.map((query) =>
      webSearch({ query, limit: LISTED_PER_QUERY }).catch(() => []),
    ),
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
  const pages = citedPages(cite, read, await readPages(read));
  return {
    ...pages,
    sources: [...pages.sources, ...hits.slice(limit).map(hitSource)],
    text: pagesBlock("web", pages.results),
  };
};

const searchNews = async (cite: Cite, queries: string[]) => {
  const found = await Promise.all(
    queries.map((query) =>
      newsSearch({ query, limit: SEARCH_LIMITS.news })
        .then((result) => result.articles)
        .catch(() => []),
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
  const pages = citedPages(cite, hits, await readPages(hits), dates);
  return { ...pages, text: pagesBlock("news", pages.results) };
};

const searchAll = async (
  cite: Cite,
  { queries, arabic = [], sources }: z.infer<typeof searchInput>,
) => {
  const chosen = [...new Set(sources)];
  const webPages = chosen.some((name) => ISLAMIC_SOURCES.has(name))
    ? WEB_BESIDE_ISLAMIC
    : SEARCH_LIMITS.web;
  const runs = {
    quran: () => searchQuran(cite, queries),
    hadith: () => searchHadith(cite, [...queries, ...arabic]),
    fatwa: () => searchFatwa(cite, queries, arabic),
    fiqh: () => searchFiqh(cite, arabic.length > 0 ? arabic : queries),
    web: () => searchWeb(cite, queries, webPages),
    news: () => searchNews(cite, queries),
  } satisfies Record<SearchSource, () => Promise<Searched>>;
  const done = await Promise.all(
    chosen.map(async (name) => {
      const found = await runs[name]().catch((err: Error) => {
        console.warn(`search ${name} failed: ${reasonOf(err)}`);
        return { results: [], sources: [], text: "" };
      });
      return { name, found };
    }),
  );
  return {
    results: Object.fromEntries(
      done.map(({ name, found }) => [name, found.results]),
    ),
    sources: done.flatMap(({ found }) => found.sources),
    text: done
      .map(({ found }) => found.text)
      .filter((text) => text)
      .join("\n\n"),
  };
};

export const CORE_TOOLS: ReadonlySet<string> = new Set([
  "search",
  "quranGet",
  "hadithGet",
  "hadithCheck",
  "fiqhGet",
  "duaSearch",
  "namedReference",
  "webFetch",
  "moreTools",
]);

const PURPOSES = new Map([
  ["prayerTimes", "prayer times"],
  ["qibla", "qibla direction"],
  ["hijriDate", "Hijri dates"],
  ["islamicCalendar", "Ramadan and Eid dates"],
  ["zakatCalculator", "zakat"],
  ["zakatAlFitr", "zakat al-fitr"],
  ["fidyaKaffarah", "fidya and kaffarah"],
  ["inheritance", "inheritance shares"],
  ["islamicUnits", "sa', mudd, dinar and dirham"],
  ["namesOfAllah", "the 99 names"],
  ["redditSearch", "what people say or have experienced"],
  ["redditThread", "replies to a Reddit post"],
  ["youtubeSearch", "lectures and videos"],
  ["youtubeTranscript", "what a video says"],
  ["mapsSearch", "places by name"],
  ["placesNear", "places near coordinates"],
  ["mapsReviews", "place reviews"],
  ["geocode", "a place's coordinates"],
  ["weather", "weather"],
  ["hotelSearch", "hotels"],
  ["flightSearch", "flights"],
  ["halalStockScreen", "whether a stock is halal"],
  ["currencyConvert", "currency"],
  ["calculator", "maths"],
]);

export function sirathicTools(cite: Cite) {
  const tools = {
    search: tool({
      description:
        "Search the Quran, hadith, fatwas, fiqh books, the web or news in one call. Returns numbered results to cite.",
      inputSchema: searchInput,
      execute: (input) => searchAll(cite, input),
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.text || "No results.",
      }),
    }),
    quranGet: tool({
      description: "Read Quran verses by surah and ayah range.",
      inputSchema: quranGetInput,
      execute: async (input) => {
        const { verses, truncated } = await quranGet(input);
        const { cited, sources } = numbered(cite, verses, verseSource);
        return { verses: cited, truncated, sources };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: { verses: output.verses, truncated: output.truncated },
      }),
    }),
    hadithGet: tool({
      description: "Read hadiths by id, such as bukhari:6018.",
      inputSchema: hadithGetInput,
      execute: async (input) => {
        const { hadiths, missing } = await hadithGet(input);
        const { cited, sources } = numbered(cite, hadiths, hadithSource);
        return { hadiths: cited, missing, sources };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: { hadiths: output.hadiths, missing: output.missing },
      }),
    }),
    hadithCheck: tool({
      description:
        "Check whether a saying the user quotes is a known hadith, and its grade.",
      inputSchema: hadithCheckInput,
      execute: async (input) => {
        const { matches, ...checked } = await hadithCheck(input);
        const { cited, sources } = numbered(cite, matches, hadithSource);
        return { ...checked, matches: cited, sources };
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `Verdict: ${output.verdict}\n${hadithBlock(
          output.matches.map((match) => ({
            citation: match.citation,
            ref: `${hadithTitle(match)}, word match ${match.wordMatch}`,
            english: clip(match.english, PAGE_CHARS),
            arabic: match.textAr,
            grade: gradeOf(match),
          })),
        )}`,
      }),
    }),
    fiqhGet: tool({
      description: "Read classical fiqh passages by id.",
      inputSchema: fiqhGetInput,
      execute: fiqhGet,
    }),
    duaSearch: tool({
      description: "Find duas and adhkar for an occasion or need.",
      inputSchema: duaSearchInput,
      execute: duaSearch,
    }),
    namedReference: tool({
      description:
        "Find the reference of a verse or hadith the user names, like Ayat al-Kursi.",
      inputSchema: namedReferenceInput,
      execute: async (input) => namedReference(input),
    }),
    namesOfAllah: tool({
      description: "The 99 names of Allah and their meanings.",
      inputSchema: namesOfAllahInput,
      execute: async (input) => namesOfAllah(input),
    }),
    webFetch: tool({
      description: "Read a web page's full text.",
      inputSchema: webFetchInput,
      execute: async (input) => {
        if (textBlocked(input.url)) {
          throw new Error(
            "sunnah.com pages can't be read. Use hadithGet with the collection and number instead.",
          );
        }
        const page = await webFetch(input);
        const markdown = page.markdown.slice(0, PAGE_CHARS);
        const found = {
          url: page.url,
          title: page.title,
          snippet: plainText(markdown),
        };
        return {
          url: page.url,
          title: page.title,
          markdown,
          citation: cite(page.url),
          sources: [found],
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          url: output.url,
          title: output.title,
          markdown: output.markdown,
          citation: output.citation,
        },
      }),
    }),
    youtubeSearch: tool({
      description: "Search YouTube for lectures, recitations and how-tos.",
      inputSchema: youtubeSearchInput,
      execute: async (input) => {
        const { videos, ...found } = await youtubeSearch(input);
        const { cited, sources } = numbered(cite, videos, hitSource);
        return { ...found, videos: cited, sources };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: { query: output.query, videos: output.videos },
      }),
    }),
    youtubeTranscript: tool({
      description: "Read what a YouTube video says, from its transcript.",
      inputSchema: youtubeTranscriptInput,
      execute: async (input) => {
        const found = await youtubeTranscript(input);
        const source = {
          url: found.url,
          title: "YouTube video transcript",
          snippet: found.text.slice(0, SNIPPET_CHARS),
        };
        return { ...found, citation: cite(found.url), sources: [source] };
      },
      toModelOutput: ({ output: { sources: _sources, ...found } }) => ({
        type: "json",
        value: found,
      }),
    }),
    redditSearch: tool({
      description:
        "Search Reddit for what people say or have experienced. Not for rulings.",
      inputSchema: redditSearchInput,
      execute: async (input) => {
        const { posts, ...found } = await redditSearch({
          ...input,
          limit: LISTED_PER_QUERY,
        });
        const { cited, sources } = numbered(
          cite,
          posts.slice(0, input.limit),
          hitSource,
        );
        return {
          ...found,
          posts: cited,
          sources: [...sources, ...posts.slice(input.limit).map(hitSource)],
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: { query: output.query, posts: output.posts },
      }),
    }),
    redditThread: tool({
      description: "Read a Reddit post and its top replies.",
      inputSchema: redditThreadInput,
      execute: async (input) => {
        const thread = await redditThread(input);
        const source = {
          url: thread.url,
          title: thread.title,
          snippet: thread.text.slice(0, SNIPPET_CHARS),
        };
        return { ...thread, citation: cite(thread.url), sources: [source] };
      },
      toModelOutput: ({ output: { sources: _sources, ...thread } }) => ({
        type: "json",
        value: thread,
      }),
    }),
    mapsSearch: tool({
      description:
        "Find places by name and area on Google Maps, like halal restaurants or mosques.",
      inputSchema: mapsSearchInput,
      execute: async (input) => {
        const { places, ...found } = await mapsSearch(input);
        const { cited, sources } = numbered(cite, places, hitSource);
        return { ...found, places: cited, sources };
      },
      toModelOutput: ({ output: { sources: _sources, ...found } }) => ({
        type: "json",
        value: found,
      }),
    }),
    mapsReviews: tool({
      description: "Read a Google Maps place's reviews.",
      inputSchema: mapsReviewsInput,
      execute: async (input) => {
        const found = await mapsReviews(input);
        return { ...found, citation: cite(found.url) };
      },
    }),
    flightSearch: tool({
      description:
        "Search flights between two airports (IATA codes) on a date.",
      inputSchema: flightSearchInput,
      execute: flightSearch,
    }),
    hotelSearch: tool({
      description: "Search hotels for a place and dates.",
      inputSchema: hotelSearchInput,
      execute: async (input) => {
        const { hotels, ...found } = await hotelSearch(input);
        const { cited, sources } = numbered(cite, hotels, hitSource);
        return { ...found, hotels: cited, sources };
      },
      toModelOutput: ({ output: { sources: _sources, ...found } }) => ({
        type: "json",
        value: found,
      }),
    }),
    prayerTimes: tool({
      description: "Prayer times for a location and date.",
      inputSchema: prayerTimesInput,
      execute: async (input) => prayerTimes(input),
    }),
    qibla: tool({
      description: "The qibla direction from a location.",
      inputSchema: qiblaInput,
      execute: async (input) => qibla(input),
    }),
    hijriDate: tool({
      description:
        "Convert between Gregorian and Hijri dates, or get today's Hijri date.",
      inputSchema: hijriDateInput,
      execute: async (input) => hijriDate(input),
    }),
    islamicCalendar: tool({
      description: "Dates of Ramadan, the Eids and other occasions in a year.",
      inputSchema: islamicCalendarInput,
      execute: async (input) => islamicCalendar(input),
    }),
    geocode: tool({
      description: "Find the latitude, longitude and time zone of a place.",
      inputSchema: geocodeInput,
      execute: geocode,
    }),
    placesNear: tool({
      description: "Mosques, halal food or Islamic schools near coordinates.",
      inputSchema: placesNearInput,
      execute: async (input) => {
        const { places, ...found } = await placesNear(input);
        const { cited, sources } = numbered(cite, places, hitSource);
        return { ...found, places: cited, sources };
      },
      toModelOutput: ({ output: { sources: _sources, ...found } }) => ({
        type: "json",
        value: found,
      }),
    }),
    weather: tool({
      description: "The current weather and forecast for a location.",
      inputSchema: weatherInput,
      execute: weather,
    }),
    zakatCalculator: tool({
      description:
        "Calculate zakat on wealth, using live gold and silver prices unless given.",
      inputSchema: zakatCalculatorInput,
      execute: zakatCalculator,
    }),
    zakatAlFitr: tool({
      description: "Calculate zakat al-fitr for a household.",
      inputSchema: zakatAlFitrInput,
      execute: async (input) => zakatAlFitr(input),
    }),
    fidyaKaffarah: tool({
      description: "Calculate the fidya or kaffarah someone owes.",
      inputSchema: fidyaKaffarahInput,
      execute: async (input) => fidyaKaffarah(input),
    }),
    inheritance: tool({
      description: "Calculate Islamic inheritance (fara'id) shares.",
      inputSchema: inheritanceInput,
      execute: async (input) => inheritance(input),
    }),
    islamicUnits: tool({
      description:
        "Convert classical measures like the sa', mudd, dinar and dirham to modern units, and back.",
      inputSchema: islamicUnitsInput,
      execute: async (input) => islamicUnits(input),
    }),
    halalStockScreen: tool({
      description:
        "Screen a stock for shariah compliance from its business and financial ratios.",
      inputSchema: halalStockScreenInput,
      execute: halalStockScreen,
    }),
    currencyConvert: tool({
      description: "Convert an amount between currencies at today's rate.",
      inputSchema: currencyConvertInput,
      execute: currencyConvert,
    }),
    calculator: tool({
      description: "Evaluate math or a unit conversion.",
      inputSchema: calculatorInput,
      execute: async (input) => calculator(input),
    }),
  };
  const loadable = Object.keys(tools).filter((name) => !CORE_TOOLS.has(name));
  const listed = new Set(loadable);
  const catalog = [
    ...[...PURPOSES].flatMap(([name, purpose]) =>
      listed.has(name) ? [`${name} (${purpose})`] : [],
    ),
    ...loadable.filter((name) => !PURPOSES.has(name)),
  ];
  return {
    ...tools,
    moreTools: tool({
      description: `Load the tools a question needs, then call them: ${catalog.join(", ")}.`,
      inputSchema: z.object({
        tools: z.array(z.enum(loadable)).min(1),
      }),
      execute: async (input) => `Loaded ${input.tools.join(", ")}.`,
    }),
  };
}
