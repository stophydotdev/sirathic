import z from "zod";
import { FIQH_DOMAINS, buildSiteScope } from "@/lib/islamicSources";
import { ResearchAction } from "../../types";
import { executeScopedSearch } from "./scopedSearch";

const schema = z.object({
  queries: z
    .array(z.string())
    .describe(
      "An array of search queries to find scholarly rulings and fatwas.",
    ),
});

const actionDescription = `
Use this tool to search trusted scholarly and fatwa sources (IslamQA, IslamWeb, SeekersGuidance, Yaqeen Institute, and more) for Islamic rulings and scholarly explanations.
Use this whenever the user asks about the permissibility of something, how to perform an act of worship, or what scholars say on a matter.

Your queries should name the ruling or practice in question, e.g. "ruling fasting while traveling", "combining prayers", "zakat on stocks".
You can provide up to 3 queries at a time. Split queries across different aspects of the topic to maximize coverage.
The tool reads the top matching pages so you receive full scholarly answers with their evidences. When scholars differ, gather the different positions so the final answer can present them fairly.
`;

const fiqhSearchAction: ResearchAction<typeof schema> = {
  name: "fiqh_search",
  schema,
  getToolDescription: () =>
    "Search trusted fatwa and scholarship sources for Islamic rulings and scholarly opinions. Use for questions about permissibility, worship, and practice. Up to 3 queries at a time.",
  getDescription: () => actionDescription,
  enabled: (config) =>
    config.classification.classification.fiqhSearch === true &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const results = await executeScopedSearch({
      queries: input.queries,
      siteScope: buildSiteScope(FIQH_DOMAINS),
      scrapeTop: 2,
      additionalConfig,
    });

    return {
      type: "search_results",
      results,
    };
  },
};

export default fiqhSearchAction;
