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
Use only as many queries as needed (1-3, often 1-2 suffice). One call is normally enough — call it once with well-chosen queries and do not call it again unless a specific gap remains.
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
    const seenPaths = new Set<string>();

    const results = await executeScopedSearch({
      queries: input.queries,
      siteScope: buildSiteScope([QURAN_DOMAIN]),
      scrapeTop: 2,
      additionalConfig,
      filterUrl: (url) => {
        const localeFreePath = new URL(url).pathname.replace(
          /^\/[a-z]{2}(-[a-z]+)?\//i,
          "/",
        );
        if (seenPaths.has(localeFreePath)) return false;
        seenPaths.add(localeFreePath);
        return true;
      },
    });

    return {
      type: "search_results",
      results,
    };
  },
};

export default quranSearchAction;
