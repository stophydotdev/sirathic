import z from "zod";
import { QURAN_DOMAIN, buildSiteScope } from "@/lib/islamicSources";
import { ResearchAction } from "../../types";
import { executeScopedSearch } from "./scopedSearch";

const schema = z.object({
  queries: z
    .array(z.string())
    .describe(
      "An array of search queries to find relevant Quranic verses, surahs, and tafsir.",
    ),
});

const actionDescription = `
Use this tool to search the Quran for verses, surahs, themes, and tafsir. This searches quran.com which contains the full Quranic text, translations, and commentary.
Use this whenever the user's question touches the Quran directly ("what does the Quran say about...") or whenever Quranic evidence would strengthen the answer to a religious question.

Your queries should name the theme, story, or verse you are looking for, e.g. "patience", "Surah Al-Kahf", "story of Yusuf", "verse about charity".
You can provide up to 3 queries at a time. Split queries across different aspects of the topic to maximize coverage.
The tool reads the top matching pages so you receive the full verse text and translation, not just snippets.
`;

const quranSearchAction: ResearchAction<typeof schema> = {
  name: "quran_search",
  schema,
  getToolDescription: () =>
    "Search the Quran (quran.com) for verses, surahs, themes, and tafsir. Use for any question about Quranic content or where Quranic evidence strengthens a religious answer. Up to 3 queries at a time.",
  getDescription: () => actionDescription,
  enabled: (config) =>
    config.classification.classification.quranSearch === true &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const results = await executeScopedSearch({
      queries: input.queries,
      siteScope: buildSiteScope([QURAN_DOMAIN]),
      scrapeTop: 2,
      additionalConfig,
    });

    return {
      type: "search_results",
      results,
    };
  },
};

export default quranSearchAction;
