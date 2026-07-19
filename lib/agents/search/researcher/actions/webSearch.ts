import z from "zod";
import { webSearch } from "@/lib/webSearch";
import { Chunk } from "@/lib/types";
import { ResearchAction } from "../../types";

const actionSchema = z.object({
  queries: z
    .array(z.string())
    .describe("An array of search queries to perform web searches for."),
});

const speedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.
You are currently on speed mode, meaning you would only get to call this tool once. Make sure to prioritize the most important queries that are likely to get you the needed information in one go.

Your queries should be very targeted and specific to the information you need, avoid broad or generic queries.
Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example, if the user is asking about the features of a new technology, you might use queries like "GPT-5.1 features", "GPT-5.1 release date", "GPT-5.1 improvements" rather than a broad query like "Tell me about GPT-5.1".

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information.
`;

const balancedModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

One well-planned call is usually enough. Choose queries that together cover the different aspects of the question, and use only as many as you need (1-3).
Only call this tool again if the first results left a specific, named gap that prevents answering.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

For example if the user is asking about Tesla's latest earnings, your actions should be like:
1. __reasoning_preamble "The user is asking about Tesla's earnings. I will search for the latest earnings report, key figures, and market reaction in one round." then
2. web_search ["Tesla Q2 2026 earnings", "Tesla earnings key figures", "Tesla stock reaction earnings"] then
3. __reasoning_preamble "The results cover the earnings report and reaction; I have enough to answer."
4. done.

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information.
`;

const qualityModePrompt = `
Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.

You have to call this tool several times to gather enough information unless the question is very simple (like greeting questions or basic facts).
Start initially with broader queries to get an overview, then narrow down with more specific queries based on the results you receive.
Never stop before at least 5-6 iterations of searches unless the user question is very simple.

Your queries shouldn't be sentences but rather keywords that are SEO friendly and can be used to search the web for information.

You can search for 3 queries in one go, make sure to utilize all 3 queries to maximize the information you can gather. If a question is simple, then split your queries to cover different aspects or related topics to get a comprehensive understanding.
If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed information. You can call this tools, multiple times as needed.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: "web_search",
  schema: actionSchema,
  getToolDescription: () =>
    "Use this tool to perform general web searches based on the provided queries. Use it for everyday, non-religious information needs. For religious questions, prefer quran_search, hadith_search, and fiqh_search when they are available — only use web_search for religious topics if those tools are absent or a contemporary/factual angle is needed. Up to 3 queries at a time.",
  getDescription: (config) => {
    switch (config.mode) {
      case "speed":
        return speedModePrompt;
      case "balanced":
        return balancedModePrompt;
      case "quality":
        return qualityModePrompt;
      default:
        return speedModePrompt;
    }
  },
  enabled: (config) => config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const queries = (
      Array.isArray(input.queries) ? input.queries : [input.queries]
    ).slice(0, 3);

    additionalConfig.emitSubStep({
      type: "searching",
      queries,
    });

    const results: Chunk[] = [];

    await Promise.all(
      queries.map(async (q) => {
        const res = await webSearch(q, { limit: 8 });

        results.push(
          ...res.map((r) => ({
            content: r.description || r.title,
            metadata: {
              title: r.title,
              url: r.url,
            },
          })),
        );
      }),
    );

    const seenUrls = new Set<string>();
    const uniqueResults = results.filter((r) => {
      if (seenUrls.has(r.metadata.url)) return false;
      seenUrls.add(r.metadata.url);
      return true;
    });

    return {
      type: "search_results",
      results: uniqueResults.slice(0, 20),
    };
  },
};

export default webSearchAction;
