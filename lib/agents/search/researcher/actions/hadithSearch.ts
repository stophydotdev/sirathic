import z from "zod";
import { HADITH_DOMAIN, buildSiteScope } from "@/lib/islamicSources";
import { ResearchAction } from "../../types";
import { executeScopedSearch } from "./scopedSearch";

const schema = z.object({
  queries: z
    .array(z.string())
    .describe(
      "An array of search queries to find relevant hadith from the authentic collections.",
    ),
});

const actionDescription = `
Use this tool to search the hadith collections (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, and more). This searches sunnah.com which contains the hadith text in Arabic and English along with the collection, number, and grading.
Use this whenever the user's question touches the Sunnah or sayings of the Prophet Muhammad (peace be upon him), or whenever prophetic evidence would strengthen the answer to a religious question.

Your queries should name the topic or wording you are looking for, e.g. "intentions", "kindness to neighbors", "fasting travel", "actions are by intentions".
Use only as many queries as needed (1-3, often 1-2 suffice). One call is normally enough — call it once with well-chosen queries and do not call it again unless a specific gap remains.
The tool reads the top matching pages so you receive the full hadith text, reference, and grading, not just snippets.
`;

const hadithSearchAction: ResearchAction<typeof schema> = {
  name: "hadith_search",
  schema,
  getToolDescription: () =>
    "Search the hadith collections (sunnah.com) for prophetic narrations with references and gradings. Use for any question about the Sunnah or where prophetic evidence strengthens a religious answer. Up to 3 queries at a time.",
  getDescription: () => actionDescription,
  enabled: (config) =>
    config.classification.classification.hadithSearch === true &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const results = await executeScopedSearch({
      queries: input.queries,
      siteScope: buildSiteScope([HADITH_DOMAIN]),
      scrapeTop: 2,
      additionalConfig,
    });

    return {
      type: "search_results",
      results,
    };
  },
};

export default hadithSearchAction;
