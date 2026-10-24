import { calculator, calculatorInput } from "@sirathic/core/tools/calculator";
import { duaSearch, duaSearchInput } from "@sirathic/core/tools/duaSearch";
import { fidyaKaffarah, fidyaKaffarahInput } from "@sirathic/core/tools/fidyaKaffarah";
import { fiqhGet, fiqhGetInput } from "@sirathic/core/tools/fiqhGet";
import { geocode, geocodeInput } from "@sirathic/core/tools/geocode";
import { hadithCheck, hadithCheckInput } from "@sirathic/core/tools/hadithCheck";
import { hadithGet, hadithGetInput } from "@sirathic/core/tools/hadithGet";
import { halalStockScreen, halalStockScreenInput } from "@sirathic/core/tools/halalStockScreen";
import { hijriDate, hijriDateInput } from "@sirathic/core/tools/hijriDate";
import { inheritance, inheritanceInput } from "@sirathic/core/tools/inheritance";
import { islamicCalendar, islamicCalendarInput } from "@sirathic/core/tools/islamicCalendar";
import { islamicUnits, islamicUnitsInput } from "@sirathic/core/tools/islamicUnits";
import { namedReference, namedReferenceInput } from "@sirathic/core/tools/namedReference";
import { namesOfAllah, namesOfAllahInput } from "@sirathic/core/tools/namesOfAllah";
import { prayerTimes, prayerTimesInput } from "@sirathic/core/tools/prayerTimes";
import { qibla, qiblaInput } from "@sirathic/core/tools/qibla";
import { quranGet, quranGetInput } from "@sirathic/core/tools/quranGet";
import { redditSearch, redditSearchInput } from "@sirathic/core/tools/redditSearch";
import { redditThread, redditThreadInput } from "@sirathic/core/tools/redditThread";
import { webFetch, webFetchInput } from "@sirathic/core/tools/webFetch";
import { zakatAlFitr, zakatAlFitrInput } from "@sirathic/core/tools/zakatAlFitr";
import { zakatCalculator, zakatCalculatorInput } from "@sirathic/core/tools/zakatCalculator";
import { tool } from "ai";
import { z } from "zod";
import { told } from "../shared/settings";
import {
  type Cite,
  clip,
  gradeOf,
  hadithSource,
  hadithTitle,
  hitSource,
  numbered,
  plainText,
  SNIPPET_CHARS,
  textBlocked,
  verseSource,
} from "./cite";
import { hadithBlock, pageText } from "./compact";
import { LISTED_PER_QUERY, searchAll, searchInput } from "./search";

const PAGE_CHARS = 8_000;

export type Remember = (input: z.output<typeof told>) => Promise<object>;

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
  ["geocode", "a place's coordinates"],
  ["halalStockScreen", "whether a stock is halal"],
  ["calculator", "maths"],
]);

export function sirathicTools(cite: Cite, remember?: Remember) {
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
      description: "Check whether a saying the user quotes is a known hadith, and its grade.",
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
      description: "Find the reference of a verse or hadith the user names, like Ayat al-Kursi.",
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
        const markdown = pageText(page.markdown, PAGE_CHARS);
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
    redditSearch: tool({
      description: "Search Reddit for what people say or have experienced. Not for rulings.",
      inputSchema: redditSearchInput,
      execute: async (input) => {
        const { posts, ...found } = await redditSearch({
          ...input,
          limit: LISTED_PER_QUERY,
        });
        const { cited, sources } = numbered(cite, posts.slice(0, input.limit), hitSource);
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
      description: "Convert between Gregorian and Hijri dates, or get today's Hijri date.",
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
    zakatCalculator: tool({
      description: "Calculate zakat on wealth, using live gold and silver prices unless given.",
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
      description: "Screen a stock for shariah compliance from its business and financial ratios.",
      inputSchema: halalStockScreenInput,
      execute: halalStockScreen,
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
    remember: tool({
      description:
        "Saves preferences and lasting facts the user states about themselves, such as their madhab, answer language, answer length, where they live, their work, or that they are a revert, so later answers use them. Call it once, with everything the user stated and null for the rest. Not for details of a personal case.",
      inputSchema: told,
      strict: true,
      execute: async (input) => {
        if (!remember) return "Not saved: this chat is incognito.";
        const saved = await remember(input);
        return Object.keys(saved).length > 0 ? "Saved." : "Nothing new to save.";
      },
    }),
  };
}
