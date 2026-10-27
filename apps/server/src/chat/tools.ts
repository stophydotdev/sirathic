import { duaSearch, duaSearchInput } from "@sirathic/core/tools/duaSearch";
import { hadithsByIds } from "@sirathic/core/tools/hadithGet";
import { hadithIdOfSunnahUrl } from "@sirathic/core/tools/hadithLinks";
import { quranGet, quranGetInput } from "@sirathic/core/tools/quranGet";
import { webFetch } from "@sirathic/core/tools/webFetch";
import { publicUrl } from "@sirathic/core/web/url";
import { tool } from "ai";
import { z } from "zod";
import { question } from "../shared/messages";
import {
  type Cite,
  gradeOf,
  hadithSource,
  hadithTitle,
  numbered,
  plainText,
  textBlocked,
  verseSource,
} from "./cite";
import { pageText } from "./compact";
import { searchAll, searchInput } from "./search";

const PAGE_CHARS = 25_000;

export const CLARIFYING = "clarifying_questions";

export const clarifyingQuestions = tool({
  description: `Shows the user one question as a card with two to five short answers to tap and a box for their own. Call it before you search or answer when the answer depends on something only the user can tell you:
- the question has a subjective word, like best, good or top;
- it is a personal decision, like a marriage, a purchase, a career or a case of their own;
- the scope is open: which madhab, their situation, a budget, a place or their level;
- the question has several valid readings.
Skip it when the question has one factual answer, like how wudu is done or what a word means, or when the user already gave the scope. Ask at most one question per turn. If the user skips or dismisses it, never ask it again and answer with what you have. Put the question only in the card, not in your text. The card ends your turn, so write what they should read first and call it last, on its own. Their reply comes as their next message.`,
  inputSchema: question,
  execute: async () => ({ shown: true }),
});

const fetchUrlInput = z.object({
  urls: z
    .array(publicUrl)
    .min(1)
    .max(3)
    .describe("1 to 3 URLs to read. Prioritize the pages most important to the answer."),
});

const readPage = async (cite: Cite, url: string) => {
  if (textBlocked(url)) {
    const id = hadithIdOfSunnahUrl(url);
    const [hadith] = id === null ? [] : await hadithsByIds([id]);
    const source = hadith && hadithSource(hadith);
    if (!hadith || !source) {
      throw new Error("sunnah.com pages can't be read. Search for the hadith instead.");
    }
    const markdown = [hadithTitle(hadith), hadith.english, hadith.textAr, gradeOf(hadith)]
      .filter((part) => part)
      .join("\n\n");
    return {
      page: { url: source.url, title: source.title, markdown, citation: cite(source.url) },
      source,
    };
  }
  const page = await webFetch({ url });
  const markdown = pageText(page.markdown, PAGE_CHARS);
  return {
    page: { url: page.url, title: page.title, markdown, citation: cite(page.url) },
    source: { url: page.url, title: page.title, snippet: plainText(markdown) },
  };
};

export function sirathicTools(cite: Cite) {
  return {
    search_web: tool({
      description: `Searches the Quran, hadith, fatwas, fiqh books, the web or news in one call. Returns results with a title, link and snippet, numbered for citing. Works best with short keyword queries, not questions or multi-step reasoning.

Writing queries:
- Use the conversation to resolve short follow-ups.
- Put each entity, school or aspect in its own query. Preferred: ["Hanafi witr ruling", "Shafi'i witr ruling"]. Not: ["Hanafi vs Shafi'i witr"].
- Drop filler words.
- Never add what the user, the conversation or earlier results did not give: years, hadith numbers, a madhab, scholar names, editions.
- For time-sensitive topics, write "latest" or "upcoming" instead of guessing a date.

If results are incomplete, conflicting, only snippets, one-sided, or miss a part of the question, search again with a focused query or read the page with fetch_url before answering.`,
      inputSchema: searchInput,
      execute: (input) => searchAll(cite, input),
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.text || "No results.",
      }),
    }),
    get_verses: tool({
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
    search_duas: tool({
      description: "Find duas and adhkar for an occasion or need.",
      inputSchema: duaSearchInput,
      execute: duaSearch,
    }),
    fetch_url: tool({
      description:
        "Reads the title and full text of 1 to 3 pages at once, fetched in parallel. Use it when page-level detail matters, such as exact wording, a specific source, a list or table, or the text of a policy or fatwa, and when snippets are thin or conflicting. Pick the pages most important to the answer and batch them in one call.",
      inputSchema: fetchUrlInput,
      execute: async ({ urls }) => {
        const read = await Promise.all(
          urls.map((url) =>
            readPage(cite, url).then(
              (page) => ({ kind: "read", ...page }) as const,
              (err: Error) => ({ kind: "failed", url, error: err.message }) as const,
            ),
          ),
        );
        const pages = read.flatMap((entry) => (entry.kind === "read" ? [entry] : []));
        if (pages.length === 0) {
          throw new Error(
            read.map((entry) => (entry.kind === "failed" ? entry.error : "")).join("\n"),
          );
        }
        return {
          pages: read.map((entry) =>
            entry.kind === "read" ? entry.page : { url: entry.url, error: entry.error },
          ),
          sources: pages.map((entry) => entry.source),
        };
      },
      toModelOutput: ({ output }) => ({ type: "json", value: { pages: output.pages } }),
    }),
  };
}
