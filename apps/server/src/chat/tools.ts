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
import { documentLinks, pageText } from "./compact";
import { fenced, fencedText } from "./fence";
import { searchAll, searchInput } from "./search";
import type { SourceKind } from "../shared/sources";
import { readVideo } from "./youtube";

const PAGE_CHARS = 25_000;

export const CLARIFYING = "clarifying_questions";

export const clarifyingQuestions = tool({
  description: `Shows the user one question as a card with two to five short answers to tap and a box for their own. Set multiple when several answers apply, so they can tick more than one. In Research mode, call it before you search or answer when:
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

export const SEND_FEEDBACK = "send_feedback";

export const sendFeedback = tool({
  description:
    "Send product feedback to the Sirathic team on the user's behalf. Use this ONLY when the user explicitly asks to file, send, or pass along feedback about Sirathic. Summarize their feedback faithfully in their own words; never invent feedback and never send it unprompted. Never include code, credentials, file contents, or content drawn from plugins unless the user dictated it as part of their feedback. Feedback filed with this tool is read as product feedback but never receives a reply. Do not ask whether the user wants a reply and do not promise one. The user reviews the exact message on an approval card and nothing is sent unless they approve. A declined card is final: don't send it again or reword it; tell the user it wasn't sent.",
  inputSchema: z.object({
    message: z.string().min(1).max(4000).describe("The user's feedback, in their own words."),
  }),
  execute: async () => ({ sent: true }),
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
  const video = await readVideo(url);
  if (video) {
    return {
      page: {
        url,
        title: video.source.title,
        markdown: pageText(video.markdown, PAGE_CHARS),
        citation: cite(url),
      },
      source: video.source,
    };
  }
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
  const text = pageText(page.markdown, PAGE_CHARS);
  const documents = documentLinks(page.markdown);
  return {
    page: {
      url: page.url,
      title: page.title,
      markdown: documents ? `${text}\n\n${documents}` : text,
      citation: cite(page.url),
    },
    source: { url: page.url, title: page.title, snippet: plainText(text) },
  };
};

export function sirathicTools(cite: Cite, kinds?: SourceKind[]) {
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
      execute: (input) => searchAll(cite, input, kinds),
      toModelOutput: ({ output }) => fenced({ type: "text", value: output.text || "No results." }),
    }),
    ...((!kinds || kinds.includes("quran")) && {
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
      toModelOutput: ({ output }) => ({
        type: "text",
        value: [
          fencedText(JSON.stringify({ pages: output.pages.filter((page) => !("error" in page)) })),
          ...output.pages.flatMap((page) =>
            "error" in page ? [`${page.url} was not read: ${page.error}`] : [],
          ),
        ].join("\n"),
      }),
    }),
  };
}
