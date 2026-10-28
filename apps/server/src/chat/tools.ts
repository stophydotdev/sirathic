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
  description: `Shows the user one question as a card with two to five short answers to tap and a box for their own. In Research mode, call it before you search or answer when:
- a subjective term is present, like best, good or top, and the answer depends on the user's own needs;
- it is a personal decision, like a marriage, a purchase, an investment or a career;
- the scope is undefined: which madhab, a budget, a timeframe, their experience level or their region;
- several valid interpretations exist;
- a financial question depends on personal context, like whether to invest in something;
- a skill tells you to ask a certain question.
Skip it when the question has a single factual answer, like how wudu is done or what a word means, or when the scope is already specified. Skip it when the answer is what people in general prefer or recommend, which you can search. Never use it to ask for the details of a sin.
Use only this tool when clarification is needed. Don't ask clarifying questions in your answer text. Ask one natural question, and make every answer a real option. The card ends your turn. Their reply comes as their next message. A dismissed question is a decline: proceed directly using reasonable defaults, and don't ask it again in any form.`,
  inputSchema: question,
  execute: async () => ({ shown: true }),
});

const fetchUrlInput = z.object({
  urls: z
    .array(publicUrl)
    .min(1)
    .max(3)
    .describe(
      "Up to 3 URLs to navigate to and extract content from. Prioritize the pages most important to the answer.",
    ),
});

const STOPHY_ROUTE = /Call ([\w.]+) \(\w+ in MCP\) with (\w+) set to this address/u;

export const routedToStophy = (message: string) =>
  message.replace(
    STOPHY_ROUTE,
    "Load the stophy skill, then call stophy_call with id $1 and $2 set to this address",
  );

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
      description: `Searches the Quran, hadith, fatwas, fiqh books, the web and news for current and factual information, returning relevant results with titles, URLs and content snippets, numbered for citing. Use for questions about up-to-date or externally verified information. Works best with short, keyword-focused queries. Complex multi-step reasoning queries are not supported.

Best practices:
- Limit to max 3 queries per request. For multi-part requests, use the query slots to cover distinct entities or aspects.
- Use conversation history to resolve short or ambiguous follow-ups.
- For multi-entity questions, use separate single-entity queries: Preferred: ["Hanafi witr ruling", "Shafi'i witr ruling"]. Not: ["Hanafi vs Shafi'i witr"].
- Keep queries short and focused, and omit filler words. Preferred: ["zakat on gold jewelry"]. Not: ["Do I have to pay zakat on my gold jewelry?"]
- Do not add identifiers that were not provided by the user, prior conversation, or tool results. This includes years, editions, hadith numbers, a school of fiqh, scholar names, titles and versions.
- For ambiguous recurring or time-sensitive topics, use neutral freshness terms such as "latest", "next", or "upcoming" instead of assuming a specific event, date, or outcome.

If results are incomplete, conflicting, snippet-level, single-sided, or do not cover a distinct requested part, call search_web again with a focused query or use fetch_url before answering.`,
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
        value: {
          verses: output.verses.map(({ textAr: _shownByTheCard, ...verse }) => verse),
          truncated: output.truncated,
        },
      }),
    }),
    fetch_url: tool({
      description:
        "Navigate to URLs and extract their content. Returns the page title and text content for each URL. Use this to read the full content of web pages found via search_web. Use it when page-level details would improve the answer. Prefer fetch_url over answering from snippets when the user asks about a specific URL, source, list, policy, fatwa, article, table, exact wording, or any answer that depends on details likely hidden beyond the snippet. Batch fetch when appropriate. When a user pastes a full URL in the query, you must call fetch_url to retrieve that URL's information.",
      inputSchema: fetchUrlInput,
      execute: async ({ urls }) => {
        const read = await Promise.all(
          urls.map((url) =>
            readPage(cite, url).then(
              (page) => ({ kind: "read", ...page }) as const,
              (err: Error) =>
                ({ kind: "failed", url, error: routedToStophy(err.message) }) as const,
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
