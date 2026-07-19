import z from "zod";
import { webFetch } from "@sirathic/core/webFetch";
import type { Chunk } from "@sirathic/core/types";
import type { ResearchAction } from "../../types";

const MAX_CONTENT_CHARS = 8000;

const schema = z.object({
  urls: z.array(z.string()).describe("A list of URLs to scrape content from."),
});

const actionDescription = `
Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.
You should only call this tool when the user has specifically requested information from certain web pages, never call this yourself to get extra information without user instruction.

For example, if the user says "Please summarize the content of https://example.com/article", you can call this tool with that URL to get the content and then provide the summary or "What does X mean according to https://example.com/page", you can call this tool with that URL to get the content and provide the explanation.
`;

const scrapeURLAction: ResearchAction<typeof schema> = {
  name: "scrape_url",
  schema: schema,
  getToolDescription: () =>
    "Use this tool to scrape and extract content from the provided URLs. This is useful when you the user has asked you to extract or summarize information from specific web pages. You can provide up to 3 URLs at a time. NEVER CALL THIS TOOL EXPLICITLY YOURSELF UNLESS INSTRUCTED TO DO SO BY THE USER.",
  getDescription: () => actionDescription,
  enabled: (_) => true,
  execute: async (input, additionalConfig) => {
    const urls = input.urls
      .filter((url) => !additionalConfig.scrapedUrls.has(url))
      .slice(0, 3);

    urls.forEach((url) => {
      additionalConfig.scrapedUrls.add(url);
    });

    if (urls.length === 0) {
      return {
        type: "search_results",
        results: [],
      };
    }

    additionalConfig.emitSubStep({
      type: "reading",
      urls,
    });

    const results: Chunk[] = [];

    await Promise.all(
      urls.map(async (url) => {
        try {
          const page = await webFetch(url, { timeoutMs: 30_000 });

          results.push({
            content: page.markdown.slice(0, MAX_CONTENT_CHARS),
            metadata: {
              title: page.title,
              url: page.url,
            },
          });
        } catch (err) {
          console.log("Error scraping data from", url, err);
        }
      }),
    );

    return {
      type: "search_results",
      results,
    };
  },
};

export default scrapeURLAction;
