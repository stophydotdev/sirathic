import { duaSearch, duaSearchInput } from "@sirathic/core/tools/duaSearch";
import { hadithsByIds } from "@sirathic/core/tools/hadithGet";
import { hadithIdOfSunnahUrl } from "@sirathic/core/tools/hadithLinks";
import { quranGet, quranGetInput } from "@sirathic/core/tools/quranGet";
import { webFetch, webFetchInput } from "@sirathic/core/tools/webFetch";
import { tool } from "ai";
import { z } from "zod";
import { told } from "../shared/settings";
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

const PAGE_CHARS = 8_000;

export type Remember = (input: z.output<typeof told>) => Promise<object>;

export function sirathicTools(cite: Cite, remember?: Remember) {
  return {
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
    duaSearch: tool({
      description: "Find duas and adhkar for an occasion or need.",
      inputSchema: duaSearchInput,
      execute: duaSearch,
    }),
    webFetch: tool({
      description: "Read a web page's full text.",
      inputSchema: webFetchInput,
      execute: async (input) => {
        if (textBlocked(input.url)) {
          const id = hadithIdOfSunnahUrl(input.url);
          const [hadith] = id === null ? [] : await hadithsByIds([id]);
          const source = hadith && hadithSource(hadith);
          if (!hadith || !source) {
            throw new Error("sunnah.com pages can't be read. Search for the hadith instead.");
          }
          const markdown = [hadithTitle(hadith), hadith.english, hadith.textAr, gradeOf(hadith)]
            .filter((part) => part)
            .join("\n\n");
          return {
            url: source.url,
            title: source.title,
            markdown,
            citation: cite(source.url),
            sources: [source],
          };
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
