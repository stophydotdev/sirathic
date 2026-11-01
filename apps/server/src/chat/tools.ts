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

export const botQuestions = {
  ...clarifyingQuestions,
  description: `Shows the user one question as a card with two to five short answers to tap and a box for their own. Set multiple when several answers apply, so they can tick more than one. Default to deciding and proceeding; use it only when a decision truly needs the user: a wrong guess has real consequences, remaining ambiguity would materially change the result, or the answer depends on something only the user knows and you couldn't find it. Never use it to ask for the details of a sin. Don't use it to confirm a tool that shows its own card; call the tool. Ask one natural question, and make every answer a real option. The card ends your turn. Their reply comes as their next message. A dismissed question is a decline: don't ask it again in any form.`,
};

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

const routedToStophy = (message: string) =>
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
      description: `Searches the Quran, hadith, fatwas, fiqh books, the web and news for current and factual information, returning relevant results with titles, URLs and content snippets, numbered for citing. Use for questions about up-to-date or externally verified information. Works best with short, keyword-focused queries. Complex multi-step reasoning queries are not supported. Results come from an external search index that some sites block, so a missing or stale result is not evidence a page or fact does not exist. When search comes up empty for something that should exist, try fetch_url on a likely URL, then your browser when you have one.

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
          const { verses, truncated, translatedBy } = await quranGet(input);
          const { cited, sources } = numbered(cite, verses, verseSource);
          return { verses: cited, truncated, translatedBy, sources };
        },
        toModelOutput: ({ output }) => ({
          type: "json",
          value: {
            verses: output.verses.map(({ textAr: _shownByTheCard, ...verse }) => verse),
            truncated: output.truncated,
            translatedBy: output.translatedBy,
          },
        }),
      }),
    }),
    fetch_url: tool({
      description:
        "Navigate to URLs and extract their content. Returns the page title and text content for each URL. Use this to read the full content of web pages found via search_web. Use it when page-level details would improve the answer. Prefer fetch_url over answering from snippets when the user asks about a specific URL, source, list, policy, fatwa, article, table, exact wording, or any answer that depends on details likely hidden beyond the snippet. Batch fetch when appropriate. When a user pastes a full URL in the query, you must call fetch_url to retrieve that URL's information. A YouTube video comes with its transcript in timed lines like [12:04]; to point to a moment in it, link the time to the video at that second, like [12:04](https://www.youtube.com/watch?v=VIDEO_ID&t=724s). A 403 or block page from a site's firewall is not evidence the page does not exist: fall back to your browser when you have one.",
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

const BOT_SEARCH = `Search the web, news, the Quran, hadith, fatwas and fiqh books for real-time information about any topic. Returns summarized information from search results and relevant URLs.

Use this tool when you need up-to-date information that might not be available or correct in your training data, or when you need to verify current facts.
This includes queries about:
- Places, prices, schedules and services whose details change often. ("Which halal restaurants are open near me?")
- Current events or news. ("What changed in this year's Hajj rules?")
- Informational queries similar to what you might Google ("zakat on gold jewelry")

IMPORTANT - Use the correct year in search queries: use the year from today's date when searching for recent information or current events. Do not add hadith numbers, a school of fiqh, scholar names, titles or editions that the user, the conversation or a tool result did not give.

Results come from an external search index that some sites block, so a missing or stale result is not evidence a page or fact does not exist. When search comes up empty for something that should exist, try fetch_url on a likely URL, then fall back to your browser when you have one.`;

const BOT_FETCH = `Fetch content from the URLs you give and return their contents in a readable format. Use this tool when you need to retrieve and analyze webpage content.

- Each URL must be a fully-formed, valid URL.
- This tool is read-only and will not work for requests intended to have side effects.
- This fetch tries to return live results but may return previously cached content.
- Authentication is not supported, and an error will be returned if the URL requires authentication.
- If the URL is returning a non-200 status code, e.g. 404, the tool will not return the content and will instead return an error message.
- A YouTube video comes with its transcript in timed lines like [12:04]; to point to a moment in it, link the time to the video at that second, like [12:04](https://www.youtube.com/watch?v=VIDEO_ID&t=724s).

Some sites' firewalls block this tool's fetch provider with a 403 or a block page (e.g. "Request Rejected"). That is not evidence the page does not exist: fall back to your browser when you have one.`;

export const forBots = (tools: ReturnType<typeof sirathicTools>) => ({
  ...tools,
  search_web: { ...tools.search_web, description: BOT_SEARCH },
  fetch_url: { ...tools.fetch_url, description: BOT_FETCH },
});
